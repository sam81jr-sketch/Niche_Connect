// ==========================================
// CAMPUSCHAT CHAT.JS
// ==========================================

// ==========================================
// LOGIN
// ==========================================

const token =
    localStorage.getItem("campuschat_token");

const savedUser =
    localStorage.getItem("campuschat_user");

if (!token || !savedUser) {
    window.location.href = "/login.html";
    throw new Error("User is not logged in.");
}

let user;

try {
    user = JSON.parse(savedUser);
} catch (error) {
    localStorage.removeItem("campuschat_user");
    window.location.href = "/login.html";
    throw error;
}


// ==========================================
// USERNAME
// ==========================================

const myUsername =
    user.username || "User";


// ==========================================
// SOCKET.IO
// ==========================================

const socket = io({
    auth: {
        token: token
    }
});


// ==========================================
// CURRENT PARTNER
// ==========================================

let currentPartner = null;
let connectedToPartner = false;


// ==========================================
// UPDATE PARTNER
// ==========================================

function setChatPartner(username) {

    currentPartner =
        username || null;

    const topPartner =
        document.getElementById(
            "topPartnerUsername"
        );

    const headerPartner =
        document.getElementById(
            "partnerUsername"
        );

    if (username) {

        if (topPartner) {
            topPartner.textContent = username;
        }

        if (headerPartner) {
            headerPartner.textContent = username;
        }

        connectedToPartner = true;

        updateEmptyState(
            true,
            username
        );

    } else {

        if (topPartner) {
            topPartner.textContent =
                "Finding someone...";
        }

        if (headerPartner) {
            headerPartner.textContent =
                "Finding someone...";
        }

        connectedToPartner = false;

        updateEmptyState(false);
    }
}


// ==========================================
// EMPTY STATE
// ==========================================

function updateEmptyState(
    connected,
    partnerName = ""
) {

    const title =
        document.getElementById(
            "emptyTitle"
        );

    const text =
        document.getElementById(
            "emptyText"
        );

    if (!title || !text) {
        return;
    }

    if (connected) {

        title.textContent =
            `You're connected with ${partnerName}`;

        text.textContent =
            "Send a message to start chatting.";

    } else {

        title.textContent =
            "Finding someone...";

        text.textContent =
            "Please wait while we connect you with another student.";
    }
}


// ==========================================
// INITIAL STATE
// ==========================================

setChatPartner(null);


// ==========================================
// DISPLAY MESSAGE
// ==========================================

function displayMessage(data) {

    const container =
        document.getElementById(
            "messages"
        );

    if (!container) {
        return;
    }

    const emptyState =
        document.getElementById(
            "emptyState"
        );

    if (emptyState) {
        emptyState.remove();
    }

    const message =
        document.createElement("div");

    message.className =
        "message";

    if (
        String(data.userId) ===
        String(user.id)
    ) {

        message.classList.add("mine");
    }

    const name =
        document.createElement("div");

    name.className = "name";

    name.textContent =
        data.username || "User";

    const time =
        document.createElement("span");

    time.className = "time";

    if (data.time) {

        time.textContent =
            new Date(
                data.time
            ).toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );
    }

    name.appendChild(time);

    const text =
        document.createElement("div");

    text.className = "text";

    text.textContent =
        data.message || "";

    message.appendChild(name);
    message.appendChild(text);

    // Report other user's message
    if (
        String(data.userId) !==
        String(user.id)
    ) {

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

        message.appendChild(
            reportButton
        );
    }

    container.appendChild(message);

    container.scrollTop =
        container.scrollHeight;
}


// ==========================================
// MESSAGE HISTORY
// ==========================================

socket.on(
    "messageHistory",
    messages => {

        const container =
            document.getElementById(
                "messages"
            );

        if (!container) {
            return;
        }

        container.innerHTML = "";

        if (
            !messages ||
            messages.length === 0
        ) {

            container.innerHTML = `

                <div id="emptyState">

                    <div class="emptyIcon">
                        💬
                    </div>

                    <h3 id="emptyTitle">
                        ${
                            currentPartner
                            ? `You're connected with ${currentPartner}`
                            : "Finding someone..."
                        }
                    </h3>

                    <p id="emptyText">
                        ${
                            currentPartner
                            ? "Send a message to start chatting."
                            : "Please wait while we connect you with another student."
                        }
                    </p>

                </div>

            `;

            return;
        }

        messages.forEach(
            message => {
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
    data => {

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

    if (!input) {
        return;
    }

    const message =
        input.value.trim();

    if (!message) {
        return;
    }

    if (!connectedToPartner) {

        alert(
            "Please wait until you are connected to another user."
        );

        return;
    }

    socket.emit(
        "chatMessage",
        {
            message: message
        }
    );

    input.value = "";

    input.focus();
}


// ==========================================
// ENTER KEY
// ==========================================

const messageInput =
    document.getElementById(
        "messageInput"
    );

if (messageInput) {

    messageInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();
            }
        }
    );
}


// ==========================================
// CHAT ERROR
// ==========================================

socket.on(
    "chatError",
    message => {

        alert(message);

    }
);


// ==========================================
// CONNECTION
// ==========================================

socket.on(
    "connect",
    () => {

        console.log(
            "Socket connected:",
            socket.id
        );

        // Ask server for current room
        socket.emit(
            "getCurrentRoom"
        );

    }
);


// ==========================================
// CONNECTION ERROR
// ==========================================

socket.on(
    "connect_error",
    error => {

        console.error(
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
// MATCHED
// ==========================================
// IMPORTANT:
// This matches server.js:
// socket.emit("matched", {...})
// ==========================================

socket.on(
    "matched",
    data => {

        console.log(
            "Matched:",
            data
        );

        if (
            !data ||
            !data.partner
        ) {

            setChatPartner(null);

            return;
        }

        // Save partner information
        currentPartner = {
            id: data.partner.id,
            username: data.partner.username
        };

        // Used by video call
        window.currentPartnerUserId =
            data.partner.id;

        setChatPartner(
            data.partner.username
        );

        const container =
            document.getElementById(
                "messages"
            );

        if (container) {

            container.innerHTML = `

                <div id="emptyState">

                    <div class="emptyIcon">
                        💬
                    </div>

                    <h3 id="emptyTitle">
                        You're connected with
                        ${escapeHTML(
                            data.partner.username
                        )}
                    </h3>

                    <p id="emptyText">
                        Send a message to start chatting.
                    </p>

                </div>

            `;
        }

    }
);


// ==========================================
// WAITING
// ==========================================

socket.on(
    "waiting",
    data => {

        console.log(
            "Waiting:",
            data
        );

        setChatPartner(null);

        window.currentPartnerUserId =
            null;

    }
);


// ==========================================
// PARTNER LEFT
// ==========================================
// Server sends:
// "partner-left"
// ==========================================

socket.on(
    "partner-left",
    data => {

        console.log(
            "Partner left:",
            data
        );

        setChatPartner(null);

        window.currentPartnerUserId =
            null;

        const container =
            document.getElementById(
                "messages"
            );

        if (container) {

            container.innerHTML = `

                <div id="emptyState">

                    <div class="emptyIcon">
                        🔎
                    </div>

                    <h3 id="emptyTitle">
                        Finding someone...
                    </h3>

                    <p id="emptyText">
                        Your previous connection ended.
                        We're looking for a new user.
                    </p>

                </div>

            `;
        }

    }
);


// ==========================================
// ROOM ENDED
// ==========================================

socket.on(
    "room-ended",
    data => {

        console.log(
            "Room ended:",
            data
        );

        setChatPartner(null);

        window.currentPartnerUserId =
            null;

    }
);


// ==========================================
// SKIP USER
// ==========================================

function skipUser() {

    if (!connectedToPartner) {
        return;
    }

    const confirmed =
        confirm(
            "Skip this user and find someone new?"
        );

    if (!confirmed) {
        return;
    }

    if (
        typeof endVideoCall ===
        "function"
    ) {

        try {
            endVideoCall();
        } catch (error) {
            console.log(
                "Video call cleanup:",
                error
            );
        }
    }

    // IMPORTANT:
    // Server listens for "skipUser"
    socket.emit(
        "skipUser"
    );

    setChatPartner(null);

    window.currentPartnerUserId =
        null;

    const container =
        document.getElementById(
            "messages"
        );

    if (container) {

        container.innerHTML = `

            <div id="emptyState">

                <div class="emptyIcon">
                    🔎
                </div>

                <h3 id="emptyTitle">
                    Finding someone...
                </h3>

                <p id="emptyText">
                    Looking for a new student to chat with.
                </p>

            </div>

        `;
    }
}


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
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`
                    },

                    body:
                        JSON.stringify({
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
            result.message ||
            "Report submitted."
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
// HTML ESCAPE
// ==========================================

function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value == null
            ? ""
            : String(value);

    return div.innerHTML;
}


// ==========================================
// VIDEO CALL
// ==========================================

function startVideoCall() {

    if (!currentPartner) {

        alert(
            "You are not connected to another user."
        );

        return;
    }

    if (
        typeof callUser !==
        "function"
    ) {

        alert(
            "Video call module is not loaded."
        );

        return;
    }

    if (
        !window.currentPartnerUserId
    ) {

        alert(
            "Unable to find the connected user's ID."
        );

        return;
    }

    callUser(
        window.currentPartnerUserId,
        "video"
    );
}


// ==========================================
// LOGOUT
// ==========================================

function logout() {

    if (
        typeof endVideoCall ===
        "function"
    ) {

        try {
            endVideoCall();
        } catch (error) {
            console.log(
                "Video cleanup:",
                error
            );
        }
    }

    socket.disconnect();

    localStorage.removeItem(
        "campuschat_token"
    );

    localStorage.removeItem(
        "campuschat_user"
    );

    window.location.href =
        "/login.html";
}


// ==========================================
// EXPORT
// ==========================================

window.sendMessage =
    sendMessage;

window.skipUser =
    skipUser;

window.logout =
    logout;

window.reportMessage =
    reportMessage;

window.setChatPartner =
    setChatPartner;

window.startVideoCall =
    startVideoCall;
