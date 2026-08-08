// ==========================================
// NICHE CONNECT - CHAT
// ==========================================

"use strict";

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
    localStorage.removeItem("campuschat_token");
    window.location.href = "/login.html";
    throw error;
}

const myUsername =
    user.username || "User";

const socket = io({
    auth: {
        token: token
    }
});

window.chatSocket = socket;

let currentPartner = null;
let connectedToPartner = false;

function setChatPartner(username) {
    const name =
        typeof username === "string"
            ? username
            : username
                ? username.username
                : null;

    currentPartner = username || null;

    const topPartner =
        document.getElementById(
            "topPartnerUsername"
        );

    const headerPartner =
        document.getElementById(
            "partnerUsername"
        );

    if (name) {
        if (topPartner) {
            topPartner.textContent = name;
        }

        if (headerPartner) {
            headerPartner.textContent = name;
        }

        connectedToPartner = true;

        updateEmptyState(true, name);
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

function updateEmptyState(
    connected,
    partnerName = ""
) {
    const title =
        document.getElementById("emptyTitle");

    const text =
        document.getElementById("emptyText");

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

setChatPartner(null);

function displayMessage(data) {
    const container =
        document.getElementById("messages");

    if (!container) {
        return;
    }

    const emptyState =
        document.getElementById("emptyState");

    if (emptyState) {
        emptyState.remove();
    }

    const message =
        document.createElement("div");

    message.className = "message";

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
            new Date(data.time)
                .toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                });
    }

    name.appendChild(time);

    const text =
        document.createElement("div");

    text.className = "text";
    text.textContent = data.message || "";

    message.appendChild(name);
    message.appendChild(text);

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
            () => reportMessage(data.id)
        );

        message.appendChild(reportButton);
    }

    container.appendChild(message);
    container.scrollTop =
        container.scrollHeight;
}

socket.on(
    "messageHistory",
    messages => {
        const container =
            document.getElementById("messages");

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
                    <div class="emptyIcon">💬</div>
                    <h3 id="emptyTitle">
                        ${
                            currentPartner &&
                            typeof currentPartner === "object"
                                ? `You're connected with ${escapeHTML(currentPartner.username)}`
                                : "Finding someone..."
                        }
                    </h3>
                    <p id="emptyText">
                        ${
                            currentPartner &&
                            typeof currentPartner === "object"
                                ? "Send a message to start chatting."
                                : "Please wait while we connect you with another student."
                        }
                    </p>
                </div>
            `;

            return;
        }

        messages.forEach(displayMessage);
    }
);

socket.on("chatMessage", displayMessage);

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

    socket.emit("chatMessage", {
        message: message
    });

    input.value = "";
    input.focus();
}

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

socket.on(
    "chatError",
    message => {
        alert(message);
    }
);

socket.on(
    "connect",
    () => {
        console.log(
            "Socket connected:",
            socket.id
        );

        console.log(
            "CampusChat socket ready."
        );

        socket.emit("getCurrentRoom");
    }
);

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
            alert(
                "Your login session has expired. Please login again."
            );

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

socket.on(
    "duplicate-login",
    data => {
        alert(
            data &&
            data.message
                ? data.message
                : "This account is already connected."
        );

        socket.disconnect();
    }
);

socket.on(
    "matched",
    data => {
        console.log("Matched:", data);

        if (
            !data ||
            !data.partner
        ) {
            setChatPartner(null);
            window.currentPartnerUserId = null;
            return;
        }

        currentPartner = {
            id: data.partner.id,
            username: data.partner.username
        };

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
                    <div class="emptyIcon">💬</div>
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

socket.on(
    "waiting",
    () => {
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
                    <div class="emptyIcon">🔎</div>
                    <h3 id="emptyTitle">
                        Finding someone...
                    </h3>
                    <p id="emptyText">
                        Please wait while we connect you with another student.
                    </p>
                </div>
            `;
        }
    }
);

socket.on(
    "partner-left",
    data => {
        console.log(
            "Partner left:",
            data
        );

        if (
            typeof endVideoCall ===
            "function"
        ) {
            try {
                endVideoCall(false);
            } catch (error) {
                console.log(
                    "Video cleanup:",
                    error
                );
            }
        }

        setChatPartner(null);
        window.currentPartnerUserId = null;

        const container =
            document.getElementById(
                "messages"
            );

        if (container) {
            container.innerHTML = `
                <div id="emptyState">
                    <div class="emptyIcon">🔎</div>
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

socket.on(
    "room-ended",
    () => {
        setChatPartner(null);
        window.currentPartnerUserId = null;
    }
);

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
            endVideoCall(false);
        } catch (error) {
            console.log(
                "Video call cleanup:",
                error
            );
        }
    }

    socket.emit("skipUser");

    setChatPartner(null);
    window.currentPartnerUserId = null;

    const container =
        document.getElementById(
            "messages"
        );

    if (container) {
        container.innerHTML = `
            <div id="emptyState">
                <div class="emptyIcon">🔎</div>
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

async function reportMessage(messageId) {
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
                    body: JSON.stringify({
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

function escapeHTML(value) {
    const div =
        document.createElement("div");

    div.textContent =
        value == null
            ? ""
            : String(value);

    return div.innerHTML;
}

function startVideoCall() {
    if (
        !currentPartner ||
        typeof currentPartner !== "object"
    ) {
        alert(
            "You are not connected to another user."
        );
        return;
    }

    if (!window.currentPartnerUserId) {
        alert(
            "Unable to find the connected user's ID."
        );
        return;
    }

    if (
        typeof window.callUser !==
        "function"
    ) {
        alert(
            "Video call module is not loaded. Please refresh the page."
        );

        console.error(
            "video.js did not load callUser(). Check the video.js console errors."
        );

        return;
    }

    console.log(
        "Starting video call with:",
        window.currentPartnerUserId
    );

    window.callUser(
        window.currentPartnerUserId,
        "video"
    );
}

function logout() {
    if (
        typeof endVideoCall ===
        "function"
    ) {
        try {
            endVideoCall(false);
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

window.sendMessage = sendMessage;
window.skipUser = skipUser;
window.startVideoCall = startVideoCall;
window.logout = logout;

console.log(
    "CHAT.JS: loaded successfully"
);
