const token = localStorage.getItem("campuschat_token");


// ==========================================
// CHECK LOGIN
// ==========================================

if (!token) {
    window.location.href = "/login.html";
}


const savedUser =
    localStorage.getItem("campuschat_user");

if (!savedUser) {
    window.location.href = "/login.html";
}


const user = JSON.parse(savedUser);

document.getElementById("username").textContent =
    user.username;


// ==========================================
// SOCKET.IO CONNECTION
// ==========================================

const socket = io({
    auth: {
        token: token
    }
});


// ==========================================
// DISPLAY MESSAGE
// ==========================================

function displayMessage(data) {

    const container =
        document.getElementById("messages");


    const message =
        document.createElement("div");

    message.className = "message";


    // USERNAME

    const name =
        document.createElement("div");

    name.className = "name";

    name.textContent =
        data.username;


    // TIME

    const time =
        document.createElement("span");

    time.className = "time";

    if (data.time) {

        time.textContent =
            new Date(data.time)
            .toLocaleTimeString();

    }


    name.appendChild(time);


    // MESSAGE TEXT

    const text =
        document.createElement("div");

    text.className = "text";

    // textContent keeps messages safe

    text.textContent =
        data.message;


    // REPORT BUTTON

    const reportButton =
        document.createElement("button");

    reportButton.className =
        "reportButton";

    reportButton.textContent =
        "🚨 Report";


    reportButton.addEventListener(
        "click",
        () => {

            reportMessage(data.id);

        }
    );


    // BUILD MESSAGE

    message.appendChild(name);

    message.appendChild(text);

    message.appendChild(reportButton);


    container.appendChild(message);


    // AUTO SCROLL

    container.scrollTop =
        container.scrollHeight;

}


// ==========================================
// MESSAGE HISTORY
// ==========================================

socket.on(
    "messageHistory",
    (messages) => {

        const container =
            document.getElementById("messages");


        container.innerHTML = "";


        messages.forEach(
            (message) => {

                displayMessage(message);

            }
        );

    }
);


// ==========================================
// NEW MESSAGE
// ==========================================

socket.on(
    "chatMessage",
    (data) => {

        displayMessage(data);

    }
);


// ==========================================
// SEND MESSAGE
// ==========================================

function sendMessage() {

    const input =
        document.getElementById(
            "messageInput"
        );


    const message =
        input.value.trim();


    if (!message) {
        return;
    }


    socket.emit(
        "chatMessage",
        {
            message: message
        }
    );


    input.value = "";

}


// ==========================================
// CHAT / MODERATION ERROR
// ==========================================

socket.on(
    "chatError",
    (message) => {

        alert(message);

    }
);


// ==========================================
// SOCKET CONNECTION ERROR
// ==========================================

socket.on(
    "connect_error",
    (error) => {

        console.log(
            "Socket connection error:",
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

        }

    }
);


// ==========================================
// REPORT MESSAGE
// ==========================================

async function reportMessage(
    messageId
) {

    if (!messageId) {

        alert(
            "Unable to identify this message."
        );

        return;

    }


    const reason =
        prompt(
            "Why are you reporting this message?"
        );


    if (
        !reason ||
        !reason.trim()
    ) {

        return;

    }


    try {

        const response =
            await fetch(
                "/api/reports",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        messageId:
                            messageId,

                        reason:
                            reason.trim()

                    })

                }
            );


        const result =
            await response.json();


        alert(
            result.message
        );


    } catch (error) {

        console.error(
            "Report error:",
            error
        );


        alert(
            "Unable to submit report."
        );

    }

}


// ==========================================
// ENTER KEY
// ==========================================

const messageInput =
    document.getElementById(
        "messageInput"
    );


messageInput.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Enter"
        ) {

            event.preventDefault();

            sendMessage();

        }

    }
);


// ==========================================
// LOGOUT
// ==========================================

function logout() {

    localStorage.removeItem(
        "campuschat_token"
    );

    localStorage.removeItem(
        "campuschat_user"
    );


    window.location.href =
        "/login.html";

}
