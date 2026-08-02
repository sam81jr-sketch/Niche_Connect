const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error(
        "JWT_SECRET environment variable is required."
    );
}

// Change these before using the app publicly.
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123!";


router.post("/login", (req, res) => {

    const {
        username,
        password
    } = req.body;


    if (
        username !== ADMIN_USERNAME ||
        password !== ADMIN_PASSWORD
    ) {

        return res.status(401).json({

            success: false,

            message:
                "Invalid admin username or password."

        });

    }


    const token =
        jwt.sign(
            {
                username:
                    ADMIN_USERNAME,

                role:
                    "admin"
            },

            JWT_SECRET,

            {
                expiresIn:
                    "2h"
            }
        );


    res.json({

        success: true,

        token:

            token

    });

});


module.exports = router;
