const express = require("express");
const https = require("https");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const { db, initDatabase } = require("./database/database");
const authRoutes = require("./routes/auth");
const reportRoutes = require("./routes/reports");
const adminRoutes = require("./routes/admin");
const adminLoginRoutes = require("./routes/adminLogin");

const { containsBlockedWord } = require("./services/moderation");
const { addStrike, isBanned } = require("./services/banService");

const app = express();

let server;

if (process.env.RENDER) {

    server = require("http").createServer(app);

} else {

    const sslOptions = {
        key: fs.readFileSync(
            path.join(__dirname, "key.pem")
        ),

        cert: fs.readFileSync(
            path.join(__dirname, "cert.pem")
        )
    };

    server = https.createServer(
        sslOptions,
        app
    );
}

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required.");
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin-auth", adminLoginRoutes);

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "chat.html"));
});

app.get("/api/status", (req, res) => {
    res.json({
        status: "online",
        application: "NICHE Connect",
        database: "connected",
        https: true,
        time: new Date().toISOString()
    });
});

let waitingUser = null;
const connectedUsers = new Map();

io.use((socket, next) => {
    try {
        const token =
            socket.handshake.auth &&
            socket.handshake.auth.token;

        if (!token) {
            return next(new Error("Authentication required"));
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;

        next();
    } catch (error) {
        console.log(
            "Socket authentication failed:",
            error.message
        );

        next(new Error("Invalid authentication token"));
    }
});

function createCallId() {
    return (
        "call_" +
        Date.now() +
        "_" +
        Math.random().toString(36).substring(2, 10)
    );
}

async function createRoom(socketA, socketB) {
    const roomId =
        "room_" +
        Date.now() +
        "_" +
        Math.random().toString(36).substring(2, 8);

    const room = {
        id: roomId,
        user1Id: socketA.user.id,
        user1Username: socketA.user.username,
        user2Id: socketB.user.id,
        user2Username: socketB.user.username,
        active: true,
        videoCallActive: false,
        activeCallId: null,
        createdAt: Date.now(),
        endedAt: null
    };

    if (!Array.isArray(db.data.rooms)) {
        db.data.rooms = [];
    }

    db.data.rooms.push(room);

    socketA.currentRoomId = roomId;
    socketB.currentRoomId = roomId;

    socketA.partnerSocketId = socketB.id;
    socketB.partnerSocketId = socketA.id;

    socketA.partnerUserId = socketB.user.id;
    socketB.partnerUserId = socketA.user.id;

    socketA.join(roomId);
    socketB.join(roomId);

    await db.write();

    return room;
}

function getUserRoom(socket) {
    if (!socket.currentRoomId) {
        return null;
    }

    return (db.data.rooms || []).find(
        room => room.id === socket.currentRoomId
    ) || null;
}

function getPartnerSocket(socket) {
    if (!socket.partnerSocketId) {
        return null;
    }

    return io.sockets.sockets.get(socket.partnerSocketId) || null;
}

function findPartner(socket) {
    if (!socket.connected || socket.currentRoomId) {
        return;
    }

    if (waitingUser && waitingUser.id === socket.id) {
        return;
    }

    if (waitingUser && !waitingUser.connected) {
        waitingUser = null;
    }

    if (!waitingUser) {
        waitingUser = socket;

        socket.emit("waiting", {
            message: "Waiting for another student..."
        });

        console.log(socket.user.username, "is waiting");
        return;
    }

    if (
        String(waitingUser.user.id) ===
        String(socket.user.id)
    ) {
        socket.emit("waiting", {
            message: "Waiting for another student..."
        });
        return;
    }

    const partner = waitingUser;
    waitingUser = null;

    if (!partner.connected) {
        findPartner(socket);
        return;
    }

    createRoom(partner, socket)
        .then(room => {
            console.log(
                "Private room created:",
                room.id
            );

            partner.emit("matched", {
                roomId: room.id,
                partner: {
                    id: socket.user.id,
                    username: socket.user.username
                }
            });

            socket.emit("matched", {
                roomId: room.id,
                partner: {
                    id: partner.user.id,
                    username: partner.user.username
                }
            });
        })
        .catch(error => {
            console.error("Room creation error:", error);

            if (
                socket.connected &&
                !socket.currentRoomId
            ) {
                findPartner(socket);
            }
        });
}

async function endRoom(socket, reason = "ended") {
    const room = getUserRoom(socket);

    if (!room) {
        return;
    }

    room.active = false;
    room.videoCallActive = false;
    room.activeCallId = null;
    room.endedAt = Date.now();

    await db.write();

    const partner = getPartnerSocket(socket);

    if (partner) {
        partner.currentRoomId = null;
        partner.partnerSocketId = null;
        partner.partnerUserId = null;

        partner.leave(room.id);

        partner.emit("partner-left", {
            reason
        });

        findPartner(partner);
    }

    socket.leave(room.id);

    socket.currentRoomId = null;
    socket.partnerSocketId = null;
    socket.partnerUserId = null;

    socket.emit("room-ended", {
        reason
    });
}

io.on("connection", socket => {
    console.log(
        "User connected:",
        socket.user.username,
        socket.id
    );

    const userId = String(socket.user.id);

    if (connectedUsers.has(userId)) {
        socket.emit("duplicate-login", {
            message: "This account is already connected."
        });

        socket.disconnect(true);
        return;
    }

    connectedUsers.set(userId, socket.id);

    socket.currentRoomId = null;
    socket.partnerSocketId = null;
    socket.partnerUserId = null;

    findPartner(socket);

    socket.on("getCurrentRoom", () => {
        const room = getUserRoom(socket);

        if (!room || !room.active) {
            socket.emit("noRoom");
            return;
        }

        const partner = getPartnerSocket(socket);

        socket.emit("matched", {
            roomId: room.id,
            partner: partner
                ? {
                    id: partner.user.id,
                    username: partner.user.username
                }
                : null
        });

        const messages = (db.data.messages || []).filter(
            message => message.roomId === room.id
        );

        socket.emit("messageHistory", messages);
    });

    socket.on("skipUser", async () => {
        await endRoom(socket, "skipped");
        findPartner(socket);
    });

    socket.on("chatMessage", async data => {
        try {
            if (
                !data ||
                typeof data.message !== "string"
            ) {
                return;
            }

            const text = data.message.trim();

            if (!text) {
                return;
            }

            if (text.length > 1000) {
                socket.emit(
                    "chatError",
                    "Message is too long. Maximum 1000 characters."
                );
                return;
            }

            const user = (db.data.users || []).find(
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

            const room = getUserRoom(socket);

            if (!room || !room.active) {
                socket.emit(
                    "chatError",
                    "You are not connected to a user."
                );
                return;
            }

            if (isBanned(user)) {
                socket.emit(
                    "chatError",
                    "You are temporarily banned from chatting."
                );
                return;
            }

            if (containsBlockedWord(text)) {
                const result = await addStrike(
                    db,
                    user.id
                );

                if (result && result.bannedUntil) {
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

            const newMessage = {
                id:
                    Date.now() +
                    Math.floor(Math.random() * 1000),
                roomId: room.id,
                userId: user.id,
                username: user.username,
                message: text,
                time: Date.now()
            };

            if (!Array.isArray(db.data.messages)) {
                db.data.messages = [];
            }

            db.data.messages.push(newMessage);

            if (db.data.messages.length > 10000) {
                db.data.messages =
                    db.data.messages.slice(-10000);
            }

            await db.write();

            io.to(room.id).emit(
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
    });

    // ==========================================
    // VIDEO CALL
    // ==========================================

    socket.on("call-user", async data => {
        try {
            const partner = getPartnerSocket(socket);
            const room = getUserRoom(socket);

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

            const callId = createCallId();

            room.videoCallActive = true;
            room.activeCallId = callId;

            await db.write();

            partner.emit("incoming-call", {
                callId,
                callerId: socket.user.id,
                callerUsername: socket.user.username,
                callType:
                    data && data.callType
                        ? data.callType
                        : "video"
            });

            console.log(
                "Video call:",
                socket.user.username,
                "->",
                partner.user.username,
                callId
            );
        } catch (error) {
            console.error(
                "Video call error:",
                error
            );

            socket.emit(
                "call-error",
                "Unable to start video call."
            );
        }
    });

    socket.on("answer-call", async data => {
        const partner = getPartnerSocket(socket);
        const room = getUserRoom(socket);

        if (!partner || !room || !room.active) {
            return;
        }

        if (
            data &&
            data.callId &&
            room.activeCallId &&
            data.callId !== room.activeCallId
        ) {
            return;
        }

        partner.emit("call-accepted", {
            callId: room.activeCallId
        });
    });

    // WebRTC signaling used by video.js
    socket.on("offer", data => {
        const partner = getPartnerSocket(socket);
        const room = getUserRoom(socket);

        if (
            !partner ||
            !room ||
            !room.active ||
            !data ||
            !data.offer
        ) {
            return;
        }

        partner.emit("offer", {
            callId:
                data.callId ||
                room.activeCallId,
            callerId: socket.user.id,
            userId: socket.user.id,
            offer: data.offer
        });
    });

    socket.on("answer", data => {
        const partner = getPartnerSocket(socket);
        const room = getUserRoom(socket);

        if (
            !partner ||
            !room ||
            !room.active ||
            !data ||
            !data.answer
        ) {
            return;
        }

        partner.emit("answer", {
            callId:
                data.callId ||
                room.activeCallId,
            answer: data.answer
        });
    });

    socket.on("ice-candidate", data => {
        const partner = getPartnerSocket(socket);
        const room = getUserRoom(socket);

        if (
            !partner ||
            !room ||
            !room.active ||
            !data ||
            !data.candidate
        ) {
            return;
        }

        partner.emit("ice-candidate", {
            callId:
                data.callId ||
                room.activeCallId,
            candidate: data.candidate
        });
    });

    socket.on("reject-call", async data => {
        const partner = getPartnerSocket(socket);
        const room = getUserRoom(socket);

        if (room) {
            room.videoCallActive = false;
            room.activeCallId = null;
            await db.write();
        }

        if (partner) {
            partner.emit("call-rejected", {
                callId: data && data.callId
                    ? data.callId
                    : null
            });
        }
    });

    socket.on("end-call", async data => {
        const partner = getPartnerSocket(socket);
        const room = getUserRoom(socket);

        if (room) {
            room.videoCallActive = false;
            room.activeCallId = null;
            await db.write();
        }

        if (partner) {
            partner.emit("call-ended", {
                callId: data && data.callId
                    ? data.callId
                    : null
            });
        }
    });

    socket.on("disconnect", async reason => {
        console.log(
            "User disconnected:",
            socket.user.username,
            reason
        );

        if (
            waitingUser &&
            waitingUser.id === socket.id
        ) {
            waitingUser = null;
        }

        const currentUserId =
            String(socket.user.id);

        if (
            connectedUsers.get(currentUserId) ===
            socket.id
        ) {
            connectedUsers.delete(currentUserId);
        }

        const partner = getPartnerSocket(socket);
        const room = getUserRoom(socket);

        if (room) {
            room.active = false;
            room.videoCallActive = false;
            room.activeCallId = null;
            room.endedAt = Date.now();

            await db.write();
        }

        if (partner) {
            partner.currentRoomId = null;
            partner.partnerSocketId = null;
            partner.partnerUserId = null;

            if (room) {
                partner.leave(room.id);
            }

            partner.emit("call-ended", {
                reason: "disconnected"
            });

            partner.emit("partner-left", {
                reason: "disconnected"
            });

            setTimeout(() => {
                if (
                    partner.connected &&
                    !partner.currentRoomId
                ) {
                    findPartner(partner);
                }
            }, 100);
        }

        socket.currentRoomId = null;
        socket.partnerSocketId = null;
        socket.partnerUserId = null;
    });
});

async function startServer() {
    try {
        await initDatabase();

        server.listen(
            PORT,
            "0.0.0.0",
            () => {
                console.log(
                    "=========================================="
                );
                console.log(
                    "NICHE Connect server started"
                );
                console.log(
                    "HTTPS: https://0.0.0.0:" + PORT
                );
                console.log(
                    "Local: https://127.0.0.1:" + PORT
                );
                console.log(
                    "=========================================="
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
