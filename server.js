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
            methods: ["GET", "POST"]
        },
        transports: ["websocket", "polling"]
    });


// ==========================================
// PORT
// ==========================================

const PORT =
    process.env.PORT || 3000;


// ==========================================
// JWT
// ==========================================

const JWT_SECRET =
    process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error(
        "JWT_SECRET environment variable is required."
    );
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
            application: "NICHE Connect",
            database: "connected",
            time: new Date().toISOString()
        });

    }
);


// ==========================================
// MATCHING
// ==========================================

// Only ONE socket waits here.
let waitingUser = null;


// Keep track of active sockets by user ID.
// This prevents the same account from being
// matched with itself through multiple tabs.
const activeUserSockets = new Map();


// ==========================================
// SOCKET AUTHENTICATION
// ==========================================

io.use(
    (socket, next) => {

        try {

            const token =
                socket.handshake.auth &&
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

            if (
                !decoded ||
                !decoded.id ||
                !decoded.username
            ) {

                return next(
                    new Error(
                        "Invalid authentication token"
                    )
                );

            }

            socket.user =
                decoded;

            next();

        } catch (error) {

            console.error(
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
// CREATE ROOM
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

        id: roomId,

        user1Id:
            socketA.user.id,

        user1Username:
            socketA.user.username,

        user2Id:
            socketB.user.id,

        user2Username:
            socketB.user.username,

        active: true,

        videoCallActive: false,

        createdAt:
            Date.now(),

        endedAt: null

    };


    if (
        !Array.isArray(
            db.data.rooms
        )
    ) {

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


    console.log(
        "ROOM READY:",
        roomId,
        "|",
        socketA.user.username,
        "<->",
        socketB.user.username
    );


    return room;

}


// ==========================================
// GET ROOM
// ==========================================

function getUserRoom(socket) {

    if (
        !socket.currentRoomId
    ) {

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
// GET PARTNER
// ==========================================

function getPartnerSocket(socket) {

    if (
        !socket.partnerSocketId
    ) {

        return null;

    }


    const partner =
        io.sockets.sockets.get(
            socket.partnerSocketId
        );


    if (
        !partner ||
        !partner.connected
    ) {

        return null;

    }


    return partner;

}


// ==========================================
// SEND WAITING
// ==========================================

function sendWaiting(socket) {

    if (
        !socket ||
        !socket.connected
    ) {

        return;

    }


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

}


// ==========================================
// FIND PARTNER
// ==========================================

async function findPartner(socket) {

    if (
        !socket ||
        !socket.connected
    ) {

        return;

    }


    // Already matched
    if (
        socket.currentRoomId
    ) {

        return;

    }


    // Clean stale waiting socket
    if (
        waitingUser &&
        !waitingUser.connected
    ) {

        waitingUser =
            null;

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

        sendWaiting(
            socket
        );

        return;

    }


    const partner =
        waitingUser;


    waitingUser =
        null;


    // Never match a user with himself
    if (
        String(
            partner.user.id
        ) ===
        String(
            socket.user.id
        )
    ) {

        console.log(
            "Same user attempted to match:",
            socket.user.username
        );


        // Keep the newest socket waiting
        if (
            partner.connected
        ) {

            waitingUser =
                partner;

            sendWaiting(
                socket
            );

        } else {

            sendWaiting(
                socket
            );

            waitingUser =
                socket;

        }

        return;

    }


    if (
        !partner.connected
    ) {

        waitingUser =
            socket;

        sendWaiting(
            socket
        );

        return;

    }


    try {

        const room =
            await createRoom(
                partner,
                socket
            );


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


        console.log(
            "MATCHED:",
            partner.user.username,
            "<->",
            socket.user.username
        );

    } catch (error) {

        console.error(
            "Room creation error:",
            error
        );


        if (
            partner.connected
        ) {

            waitingUser =
                partner;

        }

        sendWaiting(
            socket
        );

    }

}


// ==========================================
// END ROOM
// ==========================================

async function endRoom(
    socket,
    reason = "ended"
) {

    const room =
        getUserRoom(
            socket
        );


    if (!room) {

        return;

    }


    room.active =
        false;

    room.videoCallActive =
        false;

    room.endedAt =
        Date.now();


    const partner =
        getPartnerSocket(
            socket
        );


    socket.leave(
        room.id
    );


    socket.currentRoomId =
        null;

    socket.partnerSocketId =
        null;

    socket.partnerUserId =
        null;


    if (partner) {

        partner.leave(
            room.id
        );

        partner.currentRoomId =
            null;

        partner.partnerSocketId =
            null;

        partner.partnerUserId =
            null;

        partner.currentCallId =
            null;


        partner.emit(
            "partner-left",
            {
                reason:
                    reason
            }
        );

    }


    await db.write();


    socket.emit(
        "room-ended",
        {
            reason:
                reason
        }
    );


    // Find new partners after ending
    if (
        partner &&
        partner.connected
    ) {

        await findPartner(
            partner
        );

    }


    if (
        socket.connected
    ) {

        await findPartner(
            socket
        );

    }

}


// ==========================================
// SOCKET CONNECTION
// ==========================================

io.on(
    "connection",
    async (socket) => {

        console.log(
            "User connected:",
            socket.user.username,
            socket.id
        );


        socket.currentRoomId =
            null;

        socket.partnerSocketId =
            null;

        socket.partnerUserId =
            null;

        socket.currentCallId =
            null;


        // ==================================
        // DUPLICATE ACCOUNT CHECK
        // ==================================

        const userKey =
            String(
                socket.user.id
            );


        const oldSocket =
            activeUserSockets.get(
                userKey
            );


        if (
            oldSocket &&
            oldSocket.id !== socket.id &&
            oldSocket.connected
        ) {

            console.log(
                "Duplicate connection rejected:",
                socket.user.username
            );


            socket.emit(
                "duplicate-connection",
                {
                    message:
                        "This account is already connected in another tab or device."
                }
            );


            socket.disconnect(
                true
            );


            return;

        }


        activeUserSockets.set(
            userKey,
            socket
        );


        // ==================================
        // FIND MATCH
        // ==================================

        await findPartner(
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


                if (
                    !room ||
                    !room.active
                ) {

                    socket.emit(
                        "noRoom"
                    );

                    return;

                }


                const partner =
                    getPartnerSocket(
                        socket
                    );


                if (!partner) {

                    socket.emit(
                        "noRoom"
                    );

                    return;

                }


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
                    "Skip:",
                    socket.user.username
                );


                await endRoom(
                    socket,
                    "skipped"
                );

            }
        );


        // ==================================
        // CHAT MESSAGE
        // ==================================

        socket.on(
            "chatMessage",
            async (
                data,
                callback
            ) => {

                try {

                    console.log(
                        "CHAT MESSAGE RECEIVED:",
                        socket.user.username,
                        data
                    );


                    // Validate
                    if (
                        !data ||
                        typeof data.message !==
                            "string"
                    ) {

                        if (
                            typeof callback ===
                            "function"
                        ) {

                            callback({
                                ok: false,
                                error:
                                    "Invalid message."
                            });

                        }

                        return;

                    }


                    const text =
                        data.message.trim();


                    if (!text) {

                        if (
                            typeof callback ===
                            "function"
                        ) {

                            callback({
                                ok: false,
                                error:
                                    "Message cannot be empty."
                            });

                        }

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


                    // ==================================
                    // USER
                    // ==================================

                    const user =
                        (
                            db.data.users ||
                            []
                        ).find(
                            u =>
                                String(
                                    u.id
                                ) ===
                                String(
                                    socket.user.id
                                )
                        );


                    if (!user) {

                        socket.emit(
                            "chatError",
                            "User account not found."
                        );

                        return;

                    }


                    // ==================================
                    // ROOM
                    // ==================================

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


                    // ==================================
                    // PARTNER
                    // ==================================

                    const partner =
                        getPartnerSocket(
                            socket
                        );


                    if (!partner) {

                        socket.emit(
                            "chatError",
                            "Your chat partner is no longer connected."
                        );

                        return;

                    }


                    // Never allow accidental self-chat
                    if (
                        String(
                            partner.user.id
                        ) ===
                        String(
                            socket.user.id
                        )
                    ) {

                        socket.emit(
                            "chatError",
                            "Invalid chat partner."
                        );

                        return;

                    }


                    // ==================================
                    // BAN
                    // ==================================

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


                    // ==================================
                    // MODERATION
                    // ==================================

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


                    // ==================================
                    // MESSAGE
                    // ==================================

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


                    // ==================================
                    // DIRECT DELIVERY
                    // ==================================

                    console.log(
                        "DELIVERING MESSAGE:",
                        socket.user.username,
                        "->",
                        partner.user.username,
                        "| room:",
                        room.id
                    );


                    // Send to sender
                    socket.emit(
                        "chatMessage",
                        newMessage
                    );


                    // Send directly to partner
                    partner.emit(
                        "chatMessage",
                        newMessage
                    );


                    console.log(
                        "MESSAGE DELIVERED"
                    );


                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback({
                            ok: true,
                            messageId:
                                newMessage.id
                        });

                    }

                } catch (error) {

                    console.error(
                        "Chat message error:",
                        error
                    );


                    socket.emit(
                        "chatError",
                        "Unable to send message."
                    );


                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback({
                            ok: false,
                            error:
                                "Unable to send message."
                        });

                    }

                }

            }
        );


        // ==================================
        // VIDEO CALL
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
                            data &&
                            data.callType
                                ? data.callType
                                : "video",

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


                    await db.write();


                    socket.currentCallId =
                        callId;

                    partner.currentCallId =
                        callId;


                    console.log(
                        "VIDEO CALL:",
                        socket.user.username,
                        "->",
                        partner.user.username
                    );


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
        // ICE
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
                    socket.id,
                    reason
                );


                // Remove active socket
                const userKey =
                    String(
                        socket.user.id
                    );


                if (
                    activeUserSockets.get(
                        userKey
                    ) === socket
                ) {

                    activeUserSockets.delete(
                        userKey
                    );

                }


                // Remove waiting user
                if (
                    waitingUser &&
                    waitingUser.id ===
                        socket.id
                ) {

                    waitingUser =
                        null;

                }


                // End call
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


                if (!room) {

                    await db.write();

                    return;

                }


                const partner =
                    getPartnerSocket(
                        socket
                    );


                room.active =
                    false;

                room.videoCallActive =
                    false;

                room.endedAt =
                    Date.now();


                socket.currentRoomId =
                    null;

                socket.partnerSocketId =
                    null;

                socket.partnerUserId =
                    null;


                if (partner) {

                    partner.leave(
                        room.id
                    );

                    partner.currentRoomId =
                        null;

                    partner.partnerSocketId =
                        null;

                    partner.partnerUserId =
                        null;

                    partner.currentCallId =
                        null;


                    partner.emit(
                        "partner-left",
                        {
                            reason:
                                "disconnected"
                        }
                    );

                }


                await db.write();


                // Find a new partner
                if (
                    partner &&
                    partner.connected
                ) {

                    await findPartner(
                        partner
                    );

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
                    `Local: http://localhost:${PORT}`
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
