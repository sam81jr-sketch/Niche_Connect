const express = require("express");
const http = require("http");
const path = require("path");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const {
    db,
    initDatabase
} = require("./database/database");


const authRoutes =
    require("./routes/auth");

const reportRoutes =
    require("./routes/reports");

const adminRoutes =
    require("./routes/admin");

const adminLoginRoutes =
    require("./routes/adminLogin");


const {
    containsBlockedWord
} = require("./services/moderation");


const {
    addStrike,
    isBanned
} = require("./services/banService");


// ==========================================
// APP
// ==========================================

const app = express();

const server =
    http.createServer(app);


// ==========================================
// SOCKET.IO
// ==========================================

const io =
    new Server(server, {

        cors: {
            origin: "*",
            methods: [
                "GET",
                "POST"
            ]
        }

    });


// ==========================================
// PORT
// ==========================================
const PORT = process.env.PORT || 3000;




// ==========================================
// JWT SECRET
// ==========================================
//
// IMPORTANT:
// Change this to your own long random secret.
// Do NOT change it after users have registered
// unless you also handle existing tokens.
//

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required.");
}


// ==========================================
// MIDDLEWARE
// ==========================================

app.use(
    express.json()
);


app.use(
    express.urlencoded({
        extended: true
    })
);

// ==========================================
// STATIC FILES
// ==========================================

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


// ==========================================
// API ROUTES
// ==========================================

app.use(
    "/api/auth",
    authRoutes
);


app.use(
    "/api/reports",
    reportRoutes
);


app.use(
    "/api/admin",
    adminRoutes
);


app.use(
    "/api/admin-auth",
    adminLoginRoutes
);


// ==========================================
// STATUS
// ==========================================

app.get(
    "/api/status",
    (req, res) => {

        res.json({

            status: "online",

            application:
                "NICHE Connect",

            database:
                "connected",

            time:
                new Date().toISOString()

        });

    }
);


// ==========================================
// WAITING USER
// ==========================================

let waitingUser = null;


// ==========================================
// SOCKET AUTHENTICATION
// ==========================================

io.use(
    (socket, next) => {

        try {

            const token =
                socket.handshake.auth.token;


            if (!token) {

                return next(
                    new Error(
                        "Authentication required"
                    )
                );

            }


            const decoded =
                jwt.verify(
                    token,
                    JWT_SECRET
                );


            socket.user =
                decoded;


            next();

        } catch (error) {

            console.log(
                "Socket authentication failed:",
                error.message
            );


            next(
                new Error(
                    "Invalid authentication token"
                )
            );

        }

    }
);


// ==========================================
// CREATE PRIVATE ROOM
// ==========================================

async function createRoom(
    socketA,
    socketB
) {

    const roomId =
        "room_" +
        Date.now() +
        "_" +
        Math.random()
            .toString(36)
            .substring(2, 8);


    const room = {

        id:
            roomId,

        user1Id:
            socketA.user.id,

        user1Username:
            socketA.user.username,

        user2Id:
            socketB.user.id,

        user2Username:
            socketB.user.username,

        active:
            true,

        videoCallActive:
            false,

        createdAt:
            Date.now(),

        endedAt:
            null

    };


    if (!Array.isArray(db.data.rooms)) {
        db.data.rooms = [];
    }


    db.data.rooms.push(
        room
    );


    socketA.currentRoomId =
        roomId;

    socketB.currentRoomId =
        roomId;


    socketA.partnerSocketId =
        socketB.id;

    socketB.partnerSocketId =
        socketA.id;


    socketA.partnerUserId =
        socketB.user.id;

    socketB.partnerUserId =
        socketA.user.id;


    socketA.join(
        roomId
    );

    socketB.join(
        roomId
    );


    await db.write();


    return room;

}


// ==========================================
// GET USER ROOM
// ==========================================

function getUserRoom(socket) {

    if (!socket.currentRoomId) {
        return null;
    }


    return (
        db.data.rooms || []
    ).find(
        room =>
            room.id ===
            socket.currentRoomId
    );

}


// ==========================================
// GET PARTNER SOCKET
// ==========================================

function getPartnerSocket(socket) {

    if (!socket.partnerSocketId) {
        return null;
    }


    return io.sockets.sockets.get(
        socket.partnerSocketId
    );

}


// ==========================================
// FIND PARTNER
// ==========================================

function findPartner(socket) {

    // Already inside room
    if (socket.currentRoomId) {
        return;
    }


    // Already waiting
    if (
        waitingUser &&
        waitingUser.id === socket.id
    ) {
        return;
    }


    // Nobody waiting
    if (!waitingUser) {

        waitingUser =
            socket;


        socket.emit(
            "waiting",
            {
                message:
                    "Waiting for a new user..."
            }
        );


        console.log(
            socket.user.username,
            "is waiting"
        );


        return;
    }


    // Don't match with itself
    if (
        waitingUser.id ===
        socket.id
    ) {
        return;
    }


    const partner =
        waitingUser;


    waitingUser =
        null;


    // Check partner connection
    if (!partner.connected) {

        findPartner(socket);

        return;

    }


    createRoom(
        partner,
        socket
    )
        .then(
            room => {

                console.log(
                    "Private room created:",
                    room.id
                );


                // First user
                partner.emit(
                    "matched",
                    {

                        roomId:
                            room.id,

                        partner: {

                            id:
                                socket.user.id,

                            username:
                                socket.user.username

                        }

                    }
                );


                // Second user
                socket.emit(
                    "matched",
                    {

                        roomId:
                            room.id,

                        partner: {

                            id:
                                partner.user.id,

                            username:
                                partner.user.username

                        }

                    }
                );

            }
        )
        .catch(
            error => {

                console.error(
                    "Room creation error:",
                    error
                );

            }
        );

}


// ==========================================
// END ROOM
// ==========================================

async function endRoom(
    socket,
    reason = "ended"
) {

    const room =
        getUserRoom(socket);


    if (!room) {
        return;
    }


    room.active =
        false;


    room.videoCallActive =
        false;


    room.endedAt =
        Date.now();


    await db.write();


    const partner =
        getPartnerSocket(socket);


    if (partner) {

        partner.currentRoomId =
            null;

        partner.partnerSocketId =
            null;

        partner.partnerUserId =
            null;


        partner.leave(
            room.id
        );


        partner.emit(
            "partner-left",
            {
                reason:
                    reason
            }
        );


        findPartner(
            partner
        );

    }


    socket.leave(
        room.id
    );


    socket.currentRoomId =
        null;

    socket.partnerSocketId =
        null;

    socket.partnerUserId =
        null;


    socket.emit(
        "room-ended",
        {
            reason:
                reason
        }
    );

}


// ==========================================
// SOCKET CONNECTION
// ==========================================

io.on(
    "connection",
    (socket) => {

        console.log(
            "User connected:",
            socket.user.username
        );


        socket.currentRoomId =
            null;

        socket.partnerSocketId =
            null;

        socket.partnerUserId =
            null;


        // ==================================
        // FIND MATCH
        // ==================================

        findPartner(
            socket
        );


        // ==================================
        // CURRENT ROOM
        // ==================================

        socket.on(
            "getCurrentRoom",
            () => {

                const room =
                    getUserRoom(
                        socket
                    );


                if (!room) {

                    socket.emit(
                        "noRoom"
                    );

                    return;

                }


                const partner =
                    getPartnerSocket(
                        socket
                    );


                socket.emit(
                    "matched",
                    {

                        roomId:
                            room.id,

                        partner:
                            partner
                                ? {

                                    id:
                                        partner.user.id,

                                    username:
                                        partner.user.username

                                }
                                : null

                    }
                );


                // Send message history
                const messages =
                    (
                        db.data.messages ||
                        []
                    ).filter(
                        message =>
                            message.roomId ===
                            room.id
                    );


                socket.emit(
                    "messageHistory",
                    messages
                );

            }
        );


        // ==================================
        // SKIP USER
        // ==================================

        socket.on(
            "skipUser",
            async () => {

                console.log(
                    socket.user.username,
                    "skipped current user"
                );


                await endRoom(
                    socket,
                    "skipped"
                );


                findPartner(
                    socket
                );

            }
        );


        // ==================================
        // CHAT MESSAGE
        // ==================================

        socket.on(
            "chatMessage",
            async (data) => {

                try {

                    if (
                        !data ||
                        typeof data.message !==
                        "string"
                    ) {

                        return;

                    }


                    const text =
                        data.message.trim();


                    if (!text) {
                        return;
                    }


                    if (
                        text.length > 1000
                    ) {

                        socket.emit(
                            "chatError",
                            "Message is too long. Maximum 1000 characters."
                        );

                        return;

                    }


                    // Find user
                    const user =
                        (
                            db.data.users ||
                            []
                        ).find(
                            u =>
                                String(u.id) ===
                                String(socket.user.id)
                        );


                    if (!user) {

                        socket.emit(
                            "chatError",
                            "User account not found."
                        );

                        return;

                    }


                    // Find room
                    const room =
                        getUserRoom(
                            socket
                        );


                    if (
                        !room ||
                        !room.active
                    ) {

                        socket.emit(
                            "chatError",
                            "You are not connected to a user."
                        );

                        return;

                    }


                    // Check ban
                    if (
                        isBanned(user)
                    ) {

                        await db.write();


                        socket.emit(
                            "chatError",
                            "You are temporarily banned from chatting."
                        );

                        return;

                    }


                    // Moderation
                    if (
                        containsBlockedWord(
                            text
                        )
                    ) {

                        const result =
                            await addStrike(
                                db,
                                user.id
                            );


                        if (
                            result &&
                            result.bannedUntil
                        ) {

                            socket.emit(
                                "chatError",
                                "Message blocked. You have been temporarily banned after repeated violations."
                            );

                        } else {

                            socket.emit(
                                "chatError",
                                `Message blocked. Warning ${result.strikes}/3.`
                            );

                        }


                        return;

                    }


                    // Create message
                    const newMessage = {

                        id:
                            Date.now() +
                            Math.floor(
                                Math.random() *
                                1000
                            ),

                        roomId:
                            room.id,

                        userId:
                            user.id,

                        username:
                            user.username,

                        message:
                            text,

                        time:
                            Date.now()

                    };


                    // Save
                    if (
                        !Array.isArray(
                            db.data.messages
                        )
                    ) {

                        db.data.messages =
                            [];

                    }


                    db.data.messages.push(
                        newMessage
                    );


                    // Keep latest 10000
                    if (
                        db.data.messages.length >
                        10000
                    ) {

                        db.data.messages =
                            db.data.messages.slice(
                                -10000
                            );

                    }


                    await db.write();


                    // Send to private room
                    io.to(
                        room.id
                    ).emit(
                        "chatMessage",
                        newMessage
                    );


                } catch (error) {

                    console.error(
                        "Chat message error:",
                        error
                    );


                    socket.emit(
                        "chatError",
                        "Unable to send message."
                    );

                }

            }
        );


        // ==================================
        // START VIDEO CALL
        // ==================================

        socket.on(
            "call-user",
            async (data) => {

                try {

                    const partner =
                        getPartnerSocket(
                            socket
                        );


                    const room =
                        getUserRoom(
                            socket
                        );


                    if (
                        !partner ||
                        !room ||
                        !room.active
                    ) {

                        socket.emit(
                            "call-error",
                            "You are not connected to a user."
                        );

                        return;

                    }


                    room.videoCallActive =
                        true;


                    // Create call record
                    const callId =
                        "call_" +
                        Date.now() +
                        "_" +
                        Math.random()
                            .toString(36)
                            .substring(2, 7);


                    const call = {

                        id:
                            callId,

                        roomId:
                            room.id,

                        callerId:
                            socket.user.id,

                        callerUsername:
                            socket.user.username,

                        receiverId:
                            partner.user.id,

                        receiverUsername:
                            partner.user.username,

                        type:
                            data.callType ||
                            "video",

                        status:
                            "ringing",

                        startedAt:
                            Date.now(),

                        answeredAt:
                            null,

                        endedAt:
                            null,

                        duration:
                            0

                    };


                    if (
                        !Array.isArray(
                            db.data.calls
                        )
                    ) {

                        db.data.calls =
                            [];

                    }


                    db.data.calls.push(
                        call
                    );


                    // Save
                    await db.write();


                    // Store active call
                    socket.currentCallId =
                        callId;

                    partner.currentCallId =
                        callId;


                    // Send WebRTC offer
                    partner.emit(
                        "incoming-call",
                        {

                            callId:
                                callId,

                            fromUserId:
                                socket.user.id,

                            fromUsername:
                                socket.user.username,

                            offer:
                                data.offer,

                            callType:
                                data.callType ||
                                "video"

                        }
                    );


                } catch (error) {

                    console.error(
                        "Call start error:",
                        error
                    );


                    socket.emit(
                        "call-error",
                        "Unable to start video call."
                    );

                }

            }
        );


        // ==================================
        // ANSWER CALL
        // ==================================

        socket.on(
            "answer-call",
            async (data) => {

                const partner =
                    getPartnerSocket(
                        socket
                    );


                if (!partner) {
                    return;
                }


                const call =
                    (
                        db.data.calls ||
                        []
                    ).find(
                        item =>
                            item.id ===
                            socket.currentCallId
                    );


                if (call) {

                    call.status =
                        "active";

                    call.answeredAt =
                        Date.now();


                    await db.write();

                }


                partner.emit(
                    "call-answered",
                    {

                        answer:
                            data.answer

                    }
                );

            }
        );


        // ==================================
        // ICE CANDIDATE
        // ==================================

        socket.on(
            "ice-candidate",
            (data) => {

                const partner =
                    getPartnerSocket(
                        socket
                    );


                if (!partner) {
                    return;
                }


                partner.emit(
                    "ice-candidate",
                    {

                        candidate:
                            data.candidate

                    }
                );

            }
        );


        // ==================================
        // REJECT CALL
        // ==================================

        socket.on(
            "reject-call",
            async () => {

                const partner =
                    getPartnerSocket(
                        socket
                    );


                const room =
                    getUserRoom(
                        socket
                    );


                if (room) {

                    room.videoCallActive =
                        false;

                }


                const call =
                    (
                        db.data.calls ||
                        []
                    ).find(
                        item =>
                            item.id ===
                            socket.currentCallId
                    );


                if (call) {

                    call.status =
                        "rejected";

                    call.endedAt =
                        Date.now();

                }


                await db.write();


                if (partner) {

                    partner.currentCallId =
                        null;


                    partner.emit(
                        "call-rejected"
                    );

                }


                socket.currentCallId =
                    null;

            }
        );


        // ==================================
        // HANG UP
        // ==================================

        socket.on(
            "hang-up",
            async () => {

                const partner =
                    getPartnerSocket(
                        socket
                    );


                const room =
                    getUserRoom(
                        socket
                    );


                if (room) {

                    room.videoCallActive =
                        false;

                }


                const call =
                    (
                        db.data.calls ||
                        []
                    ).find(
                        item =>
                            item.id ===
                            socket.currentCallId
                    );


                if (call) {

                    call.status =
                        "ended";

                    call.endedAt =
                        Date.now();


                    if (
                        call.answeredAt
                    ) {

                        call.duration =
                            Math.max(
                                0,
                                Math.floor(
                                    (
                                        call.endedAt -
                                        call.answeredAt
                                    ) / 1000
                                )
                            );

                    }

                }


                await db.write();


                if (partner) {

                    partner.currentCallId =
                        null;


                    partner.emit(
                        "call-ended"
                    );

                }


                socket.currentCallId =
                    null;

            }
        );


        // ==================================
        // DISCONNECT
        // ==================================

        socket.on(
            "disconnect",
            async (reason) => {

                console.log(
                    "User disconnected:",
                    socket.user.username,
                    reason
                );


                // Remove from waiting queue
                if (
                    waitingUser &&
                    waitingUser.id ===
                    socket.id
                ) {

                    waitingUser =
                        null;

                }


                // End active call
                if (
                    socket.currentCallId
                ) {

                    const call =
                        (
                            db.data.calls ||
                            []
                        ).find(
                            item =>
                                item.id ===
                                socket.currentCallId
                        );


                    if (call) {

                        call.status =
                            "disconnected";

                        call.endedAt =
                            Date.now();


                        if (
                            call.answeredAt
                        ) {

                            call.duration =
                                Math.max(
                                    0,
                                    Math.floor(
                                        (
                                            call.endedAt -
                                            call.answeredAt
                                        ) / 1000
                                    )
                                );

                        }

                    }


                    socket.currentCallId =
                        null;

                }


                const room =
                    getUserRoom(
                        socket
                    );


                if (room) {

                    room.active =
                        false;

                    room.videoCallActive =
                        false;

                    room.endedAt =
                        Date.now();


                    await db.write();


                    const partner =
                        getPartnerSocket(
                            socket
                        );


                    if (partner) {

                        partner.currentRoomId =
                            null;

                        partner.partnerSocketId =
                            null;

                        partner.partnerUserId =
                            null;


                        partner.leave(
                            room.id
                        );


                        partner.emit(
                            "partner-left",
                            {
                                reason:
                                    "disconnected"
                            }
                        );


                        findPartner(
                            partner
                        );

                    }


                    socket.currentRoomId =
                        null;

                }


            }
        );

    }
);


// ==========================================
// START SERVER
// ==========================================

async function startServer() {

    try {

        await initDatabase();


        server.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log("");
                console.log(
                    "================================"
                );

                console.log(
                    " NICHE Connect Server"
                );

                console.log(
                    "================================"
                );

                console.log(
                    `Server running on port ${PORT}`
                );

                console.log(
                    "Local:",
                    `http://localhost:${PORT}`
                );

                console.log(
                    "================================"
                );

            }
        );


    } catch (error) {

        console.error(
            "Failed to start server:",
            error
        );

        process.exit(1);

    }

}


startServer();
