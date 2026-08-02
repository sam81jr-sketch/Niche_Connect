const express = require("express");

const { db } =
    require("../database/database");

const adminAuth =
    require("../middleware/adminAuth");

const router =
    express.Router();


// ==========================================
// ADMIN AUTHENTICATION
// ==========================================
//
// EVERYTHING BELOW THIS LINE IS ADMIN ONLY.
//

router.use(adminAuth);


// ==========================================
// ADMIN STATUS
// ==========================================

router.get(
    "/status",
    (req, res) => {

        res.json({

            success: true,

            message:
                "Admin API is working.",

            admin:
                req.admin

        });

    }
);


// ==========================================
// STATISTICS
// ==========================================

router.get(
    "/stats",
    (req, res) => {

        try {

            const users =
                db.data.users || [];

            const messages =
                db.data.messages || [];

            const reports =
                db.data.reports || [];

            const rooms =
                db.data.rooms || [];


            const activeRooms =
                rooms.filter(
                    room =>
                        room.active === true
                );


            const activeCalls =
                rooms.filter(
                    room =>
                        room.active === true &&
                        room.videoCallActive === true
                );


            const bannedUsers =
                users.filter(
                    user =>
                        user.bannedUntil &&
                        user.bannedUntil >
                        Date.now()
                );


            const pendingReports =
                reports.filter(
                    report =>
                        report.status === "pending"
                );


            res.json({

                success: true,

                stats: {

                    totalUsers:
                        users.length,

                    totalMessages:
                        messages.length,

                    totalRooms:
                        rooms.length,

                    activeRooms:
                        activeRooms.length,

                    activeVideoCalls:
                        activeCalls.length,

                    totalReports:
                        reports.length,

                    pendingReports:
                        pendingReports.length,

                    bannedUsers:
                        bannedUsers.length

                }

            });


        } catch (error) {

            console.error(
                "Admin stats error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load statistics."

            });

        }

    }
);


// ==========================================
// GET PRIVATE ROOMS
// ==========================================

router.get(
    "/rooms",
    (req, res) => {

        try {

            const rooms =
                db.data.rooms || [];

            const messages =
                db.data.messages || [];


            const result =
                rooms
                .slice()
                .reverse()
                .map(room => {

                    const roomMessages =
                        messages.filter(
                            message =>
                                String(
                                    message.roomId
                                ) ===
                                String(
                                    room.id
                                )
                        );


                    return {

                        id:
                            room.id,

                        user1: {

                            id:
                                room.user1Id,

                            username:
                                room.user1Username ||
                                "User 1"

                        },

                        user2: {

                            id:
                                room.user2Id,

                            username:
                                room.user2Username ||
                                "User 2"

                        },

                        active:
                            !!room.active,

                        videoCallActive:
                            !!room.videoCallActive,

                        createdAt:
                            room.createdAt ||
                            null,

                        endedAt:
                            room.endedAt ||
                            null,

                        messageCount:
                            roomMessages.length

                    };

                });


            res.json({

                success: true,

                count:
                    result.length,

                rooms:
                    result

            });


        } catch (error) {

            console.error(
                "Admin rooms error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load rooms."

            });

        }

    }
);


// ==========================================
// GET ROOM INFORMATION
// ==========================================

router.get(
    "/rooms/:roomId",
    (req, res) => {

        try {

            const roomId =
                req.params.roomId;


            const room =
                (db.data.rooms || [])
                .find(
                    room =>
                        String(room.id) ===
                        String(roomId)
                );


            if (!room) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Private room not found."

                });

            }


            res.json({

                success: true,

                room: {

                    id:
                        room.id,

                    user1: {

                        id:
                            room.user1Id,

                        username:
                            room.user1Username

                    },

                    user2: {

                        id:
                            room.user2Id,

                        username:
                            room.user2Username

                    },

                    active:
                        !!room.active,

                    videoCallActive:
                        !!room.videoCallActive,

                    createdAt:
                        room.createdAt ||
                        null,

                    endedAt:
                        room.endedAt ||
                        null

                }

            });


        } catch (error) {

            console.error(
                "Admin room error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load room."

            });

        }

    }
);


// ==========================================
// ADMIN MESSAGE MONITOR
// ==========================================
//
// ONLY ADMIN USERS CAN ACCESS THIS.
//
// GET:
// /api/admin/rooms/:roomId/messages
//
// ==========================================

router.get(
    "/rooms/:roomId/messages",
    (req, res) => {

        try {

            const roomId =
                req.params.roomId;


            const room =
                (db.data.rooms || [])
                .find(
                    room =>
                        String(room.id) ===
                        String(roomId)
                );


            if (!room) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Private room not found."

                });

            }


            const messages =
                (db.data.messages || [])
                .filter(
                    message =>
                        String(
                            message.roomId
                        ) ===
                        String(roomId)
                );


            const users = [

                {

                    id:
                        room.user1Id,

                    username:
                        room.user1Username ||
                        "User 1"

                },

                {

                    id:
                        room.user2Id,

                    username:
                        room.user2Username ||
                        "User 2"

                }

            ];


            res.json({

                success: true,

                roomId:
                    roomId,

                users:
                    users,

                count:
                    messages.length,

                messages:
                    messages

            });


        } catch (error) {

            console.error(
                "Admin messages error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load messages."

            });

        }

    }
);


// ==========================================
// DELETE MESSAGE
// ==========================================

router.delete(
    "/message/:messageId",
    async (req, res) => {

        try {

            const messageId =
                req.params.messageId;


            const messages =
                db.data.messages || [];


            const index =
                messages.findIndex(
                    message =>
                        String(message.id) ===
                        String(messageId)
                );


            if (index === -1) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Message not found."

                });

            }


            messages.splice(
                index,
                1
            );


            await db.write();


            res.json({

                success: true,

                message:
                    "Message deleted."

            });


        } catch (error) {

            console.error(
                "Admin delete message error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to delete message."

            });

        }

    }
);


// ==========================================
// GET USERS
// ==========================================

router.get(
    "/users",
    (req, res) => {

        try {

            const users =
                (db.data.users || [])
                .map(user => ({

                    id:
                        user.id,

                    username:
                        user.username,

                    strikes:
                        user.strikes || 0,

                    bannedUntil:
                        user.bannedUntil ||
                        null

                }));


            res.json({

                success: true,

                count:
                    users.length,

                users:
                    users

            });


        } catch (error) {

            console.error(
                "Admin users error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load users."

            });

        }

    }
);


// ==========================================
// REPORTS
// ==========================================

router.get(
    "/reports",
    (req, res) => {

        try {

            const reports =
                db.data.reports || [];


            res.json({

                success: true,

                count:
                    reports.length,

                reports:
                    reports

            });


        } catch (error) {

            console.error(
                "Admin reports error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load reports."

            });

        }

    }
);


// ==========================================
// BAN USER
// ==========================================

router.post(
    "/ban",
    async (req, res) => {

        try {

            const {
                userId,
                minutes
            } = req.body;


            if (!userId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "User ID is required."

                });

            }


            const duration =
                Number(minutes);


            if (
                !Number.isInteger(duration) ||
                duration < 1 ||
                duration > 43200
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Ban duration must be between 1 and 43200 minutes."

                });

            }


            const user =
                (db.data.users || [])
                .find(
                    user =>
                        String(user.id) ===
                        String(userId)
                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User not found."

                });

            }


            user.bannedUntil =
                Date.now() +
                duration * 60 * 1000;


            user.strikes = 0;


            await db.write();


            res.json({

                success: true,

                message:
                    `${user.username} has been banned for ${duration} minutes.`,

                bannedUntil:
                    user.bannedUntil

            });


        } catch (error) {

            console.error(
                "Admin ban error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to ban user."

            });

        }

    }
);


// ==========================================
// UNBAN USER
// ==========================================

router.post(
    "/unban",
    async (req, res) => {

        try {

            const {
                userId
            } = req.body;


            const user =
                (db.data.users || [])
                .find(
                    user =>
                        String(user.id) ===
                        String(userId)
                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User not found."

                });

            }


            user.bannedUntil = null;
            user.strikes = 0;


            await db.write();


            res.json({

                success: true,

                message:
                    `${user.username} has been unbanned.`

            });


        } catch (error) {

            console.error(
                "Admin unban error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to unban user."

            });

        }

    }
);


// ==========================================
// UPDATE REPORT
// ==========================================

router.post(
    "/report/status",
    async (req, res) => {

        try {

            const {
                reportId,
                status
            } = req.body;


            const allowedStatuses = [

                "pending",
                "reviewed",
                "resolved"

            ];


            if (
                !allowedStatuses.includes(
                    status
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid report status."

                });

            }


            const report =
                (db.data.reports || [])
                .find(
                    report =>
                        String(report.id) ===
                        String(reportId)
                );


            if (!report) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Report not found."

                });

            }


            report.status =
                status;


            await db.write();


            res.json({

                success: true,

                message:
                    "Report status updated."

            });


        } catch (error) {

            console.error(
                "Report status error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to update report."

            });

        }

    }
);


module.exports =
    router;
