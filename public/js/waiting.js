const token =
    localStorage.getItem("campuschat_token");

const savedUser =
    localStorage.getItem("campuschat_user");


// ==========================================
// CHECK LOGIN
// ==========================================

if (!token || !savedUser) {

    window.location.href =
        "/login.html";

}


// ==========================================
// ELEMENTS
// ==========================================

const statusElement =
    document.getElementById("status");

const cancelButton =
    document.getElementById("cancelButton");


// ==========================================
// SOCKET
// ==========================================

const socket = io({
    auth: {
        token: token
    }
});


// ==========================================
// CONNECTION
// ==========================================

socket.on(
    "connect",
    () => {

        statusElement.textContent =
            "Looking for another user...";

        socket.emit(
            "find-user"
        );

    }
);


// ==========================================
// WAITING
// ==========================================

socket.on(
    "waiting",
    (data) => {

        statusElement.textContent =
            data.message ||
            "Waiting for another user...";

    }
);


// ==========================================
// MATCH FOUND
// ==========================================

socket.on(
    "match-found",
    (data) => {

        console.log(
            "Match found:",
            data
        );


        statusElement.textContent =
            "User found! Opening chat...";


        // Save match information

        sessionStorage.setItem(
            "campuschat_room",
            data.roomId
        );


        sessionStorage.setItem(
            "campuschat_partner",
            JSON.stringify(
                data.partner
            )
        );


        // Open private chat

        setTimeout(
            () => {

                window.location.href =
                    "/chat.html";

            },
            500
        );

    }
);


// ==========================================
// MATCH ERROR
// ==========================================

socket.on(
    "match-error",
    (message) => {

        statusElement.textContent =
            message;

    }
);


// ==========================================
// CONNECTION ERROR
// ==========================================

socket.on(
    "connect_error",
    (error) => {

        console.error(
            "Connection error:",
            error.message
        );


        if (
            error.message ===
                "Authentication required" ||

            error.message ===
                "Invalid authentication token"
        ) {

            localStorage.removeItem(
                "campuschat_token"
            );

            localStorage.removeItem(
                "campuschat_user"
            );


            window.location.href =
                "/login.html";

            return;

        }


        statusElement.textContent =
            "Unable to connect to CampusChat.";

    }
);


// ==========================================
// CANCEL
// ==========================================

cancelButton.addEventListener(
    "click",
    () => {

        socket.disconnect();

        window.location.href =
            "/login.html";

    }
);
