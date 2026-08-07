// ==========================================
// NICHE CONNECT - CHAT.JS
// ==========================================

const token = localStorage.getItem("campuschat_token");
const savedUser = localStorage.getItem("campuschat_user");

if (!token || !savedUser) {
    window.location.href = "/login.html";
    throw new Error("User is not logged in.");
}

let user;

try {
    user = JSON.parse(savedUser);
} catch (error) {
    localStorage.removeItem("campuschat_token");
    localStorage.removeItem("campuschat_user");
    window.location.href = "/login.html";
    throw error;
}


// ==========================================
// STATE
// ==========================================

let currentPartner = null;
let currentRoomId = null;
let connectedToPartner = false;
let messageSending = false;


// Make these available to video.js
window.currentPartnerUserId = null;
window.currentRoomId = null;
window.currentPartner = null;


// ==========================================
// SOCKET
// ==========================================

const socket = io({
    auth: {
        token: token
    },

    transports: [
        "websocket",
        "polling"
    ]
});


// ==========================================
// PARTNER UI
// ==========================================

function setChatPartner(partner) {

    currentPartner = partner || null;

    window.currentPartner =
        currentPartner;

    if (currentPartner) {

        window.currentPartnerUserId =
            currentPartner.id;

        connectedToPartner = true;

        const name =
            currentPartner.username ||
            "User";

        const partnerUsername =
            document.getElementById(
                "partnerUsername"
            );

        const topPartnerUsername =
            document.getElementById(
                "topPartnerUsername"
            );

        if (partnerUsername) {
            partnerUsername.textContent =
                name;
        }

        if (topPartnerUsername) {
            topPartnerUsername.textContent =
                name;
        }

        console.log(
            "Partner set:",
            currentPartner
        );

    } else {

        window.currentPartnerUserId =
            null;

        window.currentPartner =
            null;

        connectedToPartner = false;

        const partnerUsername =
            document.getElementById(
                "partnerUsername"
            );

        const topPartnerUsername =
            document.getElementById(
                "topPartnerUsername"
            );

        if (partnerUsername) {
            partnerUsername.textContent =
                "Finding someone...";
        }

        if (topPartnerUsername) {
            topPartnerUsername.textContent =
                "Finding someone...";
        }

    }
}


// ==========================================
// DISPLAY MESSAGE
// ==========================================

function displayMessage(data) {

    if (!data) {
        return;
    }

    const container =
        document.getElementById(
            "messages"
        );

    if (!container) {
        console.error(
            "Messages container not found."
        );
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

        message.classList.add(
            "mine"
        );

    }


    const name =
        document.createElement("div");

    name.className =
        "name";

    name.textContent =
        data.username ||
        "User";


    const time =
        document.createElement("span");

    time.className =
        "time";


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

    text.className =
        "text";

    text.textContent =
        data.message || "";


    message.appendChild(name);
    message.appendChild(text);


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

        console.log(
            "Message history:",
            messages
        );

        const container =
            document.getElementById(
                "messages"
            );

        if (!container) {
            return;
        }

        container.innerHTML = "";

        if (
            !Array.isArray(messages) ||
            messages.length === 0
        ) {

            showEmptyChat();

            return;
        }

        messages.forEach(
            message => {

                displayMessage(
                    message
                );

            }
        );

    }
);


// ==========================================
// RECEIVE MESSAGE
// ==========================================

socket.on(
    "chatMessage",
    data => {

        console.log(
            "📩 MESSAGE RECEIVED:",
            data
        );

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

        console.error(
            "messageInput not found."
        );

        return;
    }


    const message =
        input.value.trim();


    if (!message) {
        return;
    }


    if (!socket.connected) {

        alert(
            "Server connection lost. Please refresh the page."
        );

        return;
    }


    if (
        !connectedToPartner ||
        !currentPartner ||
        !currentRoomId
    ) {

        alert(
            "Please wait until you are connected to another user."
        );

        console.log({
            connected:
                connectedToPartner,

            partner:
                currentPartner,

            room:
                currentRoomId,

            socket:
                socket.connected
        });

        return;
    }


    if (messageSending) {
        return;
    }


    messageSending = true;


    console.log(
        "📤 SENDING MESSAGE:",
        message
    );


    socket.emit(
        "chatMessage",
        {
            message: message
        },

        response => {

            console.log(
                "Message acknowledgement:",
                response
            );

            messageSending = false;


            if (
                !response ||
                !response.ok
            ) {

                console.error(
                    "Message rejected:",
                    response
                );

                if (
                    response &&
                    response.error
                ) {

                    alert(
                        response.error
                    );

                }

                return;
            }


            input.value = "";

            input.focus();

        }
    );


    setTimeout(
        () => {
            messageSending = false;
        },
        3000
    );
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

        console.error(
            "Chat error:",
            message
        );

        alert(message);

    }
);


// ==========================================
// CONNECT
// ==========================================

socket.on(
    "connect",
    () => {

        console.log(
            "================================"
        );

        console.log(
            "SOCKET CONNECTED"
        );

        console.log(
            "Socket ID:",
            socket.id
        );

        console.log(
            "================================"
        );


        socket.emit(
            "getCurrentRoom"
        );

    }
);


// ==========================================
// DISCONNECT
// ==========================================

socket.on(
    "disconnect",
    reason => {

        console.warn(
            "Socket disconnected:",
            reason
        );

        connectedToPartner =
            false;

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
// DUPLICATE CONNECTION
// ==========================================

socket.on(
    "duplicate-connection",
    data => {

        console.error(
            "Duplicate connection:",
            data
        );

        alert(
            "This account is already connected in another tab or device."
        );

        socket.disconnect(true);

    }
);


// ==========================================
// MATCHED
// ==========================================

socket.on(
    "matched",
    data => {

        console.log(
            "🎯 MATCHED:",
            data
        );


        if (
            !data ||
            !data.partner
        ) {

            setChatPartner(null);

            currentRoomId = null;

            window.currentRoomId =
                null;

            return;
        }


        currentRoomId =
            data.roomId;

        window.currentRoomId =
            data.roomId;


        const partner = {

            id:
                data.partner.id,

            username:
                data.partner.username

        };


        setChatPartner(
            partner
        );


        // ==================================
        // IMPORTANT FOR VIDEO.JS
        // ==================================

        window.currentPartner =
            partner;

        window.currentPartnerUserId =
            partner.id;


        // Also save for video.js
        try {

            sessionStorage.setItem(
                "currentPartner",
                JSON.stringify(partner)
            );

        } catch (error) {

            console.warn(
                "Unable to save partner:",
                error
            );

        }


        console.log(
            "VIDEO PARTNER ID:",
            window.currentPartnerUserId
        );

        console.log(
            "VIDEO PARTNER:",
            window.currentPartner
        );


        showEmptyChat();

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


        currentPartner = null;

        currentRoomId = null;

        connectedToPartner =
            false;


        window.currentPartner =
            null;

        window.currentPartnerUserId =
            null;

        window.currentRoomId =
            null;


        try {

            sessionStorage.removeItem(
                "currentPartner"
            );

        } catch (error) {}


        setChatPartner(null);

    }
);


// ==========================================
// NO ROOM
// ==========================================

socket.on(
    "noRoom",
    () => {

        console.log(
            "No active room."
        );


        currentPartner = null;

        currentRoomId = null;

        connectedToPartner =
            false;


        window.currentPartner =
            null;

        window.currentPartnerUserId =
            null;

        window.currentRoomId =
            null;


        setChatPartner(null);

    }
);


// ==========================================
// PARTNER LEFT
// ==========================================

socket.on(
    "partner-left",
    data => {

        console.log(
            "Partner left:",
            data
        );


        currentPartner = null;

        currentRoomId = null;

        connectedToPartner =
            false;


        window.currentPartner =
            null;

        window.currentPartnerUserId =
            null;

        window.currentRoomId =
            null;


        try {

            sessionStorage.removeItem(
                "currentPartner"
            );

        } catch (error) {}


        setChatPartner(null);


        showSearchingState();

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


        currentPartner = null;

        currentRoomId = null;

        connectedToPartner =
            false;


        window.currentPartner =
            null;

        window.currentPartnerUserId =
            null;

        window.currentRoomId =
            null;


        setChatPartner(null);

    }
);


// ==========================================
// SKIP USER
// ==========================================

function skipUser() {

    if (!connectedToPartner) {
        return;
    }


    if (
        !confirm(
            "Skip this user and find someone new?"
        )
    ) {

        return;

    }


    // Stop video if running
    if (
        typeof window.endVideoCall ===
        "function"
    ) {

        try {

            window.endVideoCall();

        } catch (error) {

            console.warn(
                "Video cleanup:",
                error
            );

        }

    }


    socket.emit(
        "skipUser"
    );


    currentPartner = null;
    currentRoomId = null;

    connectedToPartner =
        false;


    window.currentPartner =
        null;

    window.currentPartnerUserId =
        null;

    window.currentRoomId =
        null;


    setChatPartner(null);

}


// ==========================================
// VIDEO CALL
// ==========================================

function startVideoCall() {

    console.log(
        "================================"
    );

    console.log(
        "START VIDEO CALL"
    );

    console.log(
        "callUser:",
        typeof window.callUser
    );

    console.log(
        "partner:",
        window.currentPartner
    );

    console.log(
        "partner ID:",
        window.currentPartnerUserId
    );

    console.log(
        "room:",
        window.currentRoomId
    );

    console.log(
        "================================"
    );


    // Check video module
    if (
        typeof window.callUser !==
        "function"
    ) {

        console.error(
            "VIDEO.JS NOT LOADED"
        );

        alert(
            "Video call module is not loaded. Please refresh the page."
        );

        return;
    }


    // Check partner
    if (
        !window.currentPartnerUserId
    ) {

        alert(
            "No chat partner is connected."
        );

        return;
    }


    // Check socket
    if (
        !socket.connected
    ) {

        alert(
            "Server connection is not active."
        );

        return;
    }


    console.log(
        "Calling user:",
        window.currentPartnerUserId
    );


    // Use the actual exported video function
    window.callUser(
        window.currentPartnerUserId,
        "video"
    );

}


// ==========================================
// VIDEO CALL ALIAS
// ==========================================

window.startVideoCall =
    startVideoCall;


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
// SHOW EMPTY CHAT
// ==========================================

function showEmptyChat() {

    const container =
        document.getElementById(
            "messages"
        );

    if (!container) {
        return;
    }


    const partnerName =
        currentPartner &&
        currentPartner.username
            ? currentPartner.username
            : "your partner";


    container.innerHTML = `

        <div id="emptyState">

            <div class="emptyIcon">
                💬
            </div>

            <h3 id="emptyTitle">
                You're connected with
                ${escapeHTML(partnerName)}
            </h3>

            <p id="emptyText">
                Send a message to start chatting.
            </p>

        </div>

    `;

}


// ==========================================
// SEARCHING STATE
// ==========================================

function showSearchingState() {

    const container =
        document.getElementById(
            "messages"
        );

    if (!container) {
        return;
    }


    container.innerHTML = `

        <div id="emptyState">

            <div class="emptyIcon">
                🔎
            </div>

            <h3 id="emptyTitle">
                Finding someone...
            </h3>

            <p id="emptyText">
                Please wait while we connect you
                with another student.
            </p>

        </div>

    `;

}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(value) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        value == null
            ? ""
            : String(value);

    return div.innerHTML;
}


// ==========================================
// LOGOUT
// ==========================================

function logout() {

    if (
        typeof window.endVideoCall ===
        "function"
    ) {

        try {

            window.endVideoCall();

        } catch (error) {}

    }


    socket.disconnect();


    localStorage.removeItem(
        "campuschat_token"
    );

    localStorage.removeItem(
        "campuschat_user"
    );


    sessionStorage.removeItem(
        "currentPartner"
    );


    window.location.href =
        "/login.html";

}


// ==========================================
// DEBUG
// ==========================================

function getChatDebugInfo() {

    return {

        socketConnected:
            socket.connected,

        socketId:
            socket.id,

        user:
            user,

        currentRoomId:
            currentRoomId,

        currentPartner:
            currentPartner,

        windowPartner:
            window.currentPartner,

        partnerUserId:
            window.currentPartnerUserId,

        connectedToPartner:
            connectedToPartner,

        videoCallUser:
            typeof window.callUser

    };

}


// ==========================================
// EXPORTS
// ==========================================

window.sendMessage =
    sendMessage;

window.skipUser =
    skipUser;

window.logout =
    logout;

window.reportMessage =
    reportMessage;

window.startVideoCall =
    startVideoCall;

window.setChatPartner =
    setChatPartner;

window.getChatDebugInfo =
    getChatDebugInfo;


// ==========================================
// LOADED
// ==========================================

console.log(
    "================================"
);

console.log(
    " NICHE CONNECT CHAT.JS LOADED"
);

console.log(
    "================================"
);

console.log(
    "Video callUser currently:",
    typeof window.callUser
);
