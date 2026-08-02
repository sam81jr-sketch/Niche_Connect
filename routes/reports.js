const express = require("express");
const { db } = require("../database/database");

const router = express.Router();


// ==========================================
// CREATE REPORT
// ==========================================

router.post("/", async (req, res) => {

    try {

        const {
            messageId,
            reason
        } = req.body;


        if (!messageId || !reason) {

            return res.status(400).json({
                success: false,
                message: "Message ID and reason are required."
            });

        }


        const message =
            db.data.messages.find(
                m => String(m.id) === String(messageId)
            );


        if (!message) {

            return res.status(404).json({
                success: false,
                message: "Message not found."
            });

        }


        const report = {

            id: Date.now(),

            messageId:
                message.id,

            reportedUsername:
                message.username,

            message:
                message.message,

            reason:
                String(reason).trim(),

            status:
                "pending",

            createdAt:
                Date.now()

        };


        db.data.reports.push(report);

        await db.write();


        res.json({

            success: true,

            message:
                "Report submitted successfully."

        });


    } catch (error) {

        console.error(
            "Report error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Unable to submit report."

        });

    }

});


module.exports = router;
