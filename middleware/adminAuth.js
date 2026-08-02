const jwt = require("jsonwebtoken");


// ==========================================
// JWT SECRET
// ==========================================

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error(
        "JWT_SECRET environment variable is required."
    );
}


// ==========================================
// ADMIN AUTH MIDDLEWARE
// ==========================================

function adminAuth(req, res, next) {

    try {

        const authorization =
            req.headers.authorization;


        if (!authorization) {

            return res.status(401).json({

                success: false,

                message:
                    "Admin authentication required."

            });

        }


        if (
            !authorization.startsWith("Bearer ")
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid authorization format."

            });

        }


        const token =
            authorization.substring(7);


        if (!token) {

            return res.status(401).json({

                success: false,

                message:
                    "Admin token missing."

            });

        }


        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );


        if (
            decoded.role !== "admin"
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Admin access required."

            });

        }


        req.admin = decoded;

        next();


    } catch (error) {

        console.error(
            "Admin authentication error:",
            error.message
        );


        return res.status(401).json({

            success: false,

            message:
                "Invalid or expired admin token."

        });

    }

}


module.exports =
    adminAuth;
