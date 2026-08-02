const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { db, initDatabase } = require("../database/database");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error(
        "JWT_SECRET environment variable is required."
    );
}


// REGISTER
router.post("/register", async (req, res) => {

    try {

        await initDatabase();

        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required"
            });
        }

        if (username.length < 3) {
            return res.status(400).json({
                success: false,
                message: "Username must be at least 3 characters"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        const existingUser = db.data.users.find(
            user => user.username.toLowerCase() === username.toLowerCase()
        );

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Username already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const newUser = {
            id: Date.now(),
            username: username,
            password: hashedPassword,
            role: "user",
            strikes: 0,
            bannedUntil: null,
            createdAt: Date.now()
        };

        db.data.users.push(newUser);

        await db.write();

        res.json({
            success: true,
            message: "Account created successfully"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });

    }

});


// LOGIN
router.post("/login", async (req, res) => {

    try {

        await initDatabase();

        const { username, password } = req.body;

        const user = db.data.users.find(
            user => user.username.toLowerCase() === username.toLowerCase()
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        const passwordCorrect =
            await bcrypt.compare(password, user.password);

        if (!passwordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        if (
            user.bannedUntil &&
            user.bannedUntil > Date.now()
        ) {

            return res.status(403).json({
                success: false,
                message: "Your account is temporarily banned"
            });

        }

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role
            },
            JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });

    }

});


module.exports = router;
