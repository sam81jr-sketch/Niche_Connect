// ==========================================
// NICHE CONNECT - CHAT.JS
// ==========================================


// ==========================================
// LOGIN
// ==========================================

const token =
    localStorage.getItem(
        "campuschat_token"
    );

const savedUser =
    localStorage.getItem(
        "campuschat_user"
    );


if (
    !token ||
    !savedUser
) {

    window.location.href =
        "/login.html";

    throw new Error(
        "User is not logged in."
    );

}


let user;

try {

    user =
        JSON.parse(
            savedUser
        );

} catch (error) {

    localStorage.removeItem(
        "campuschat_user"
    );

    localStorage.removeItem(
        "campuschat_token"
    );

    window.location.href =
        "/login.html";

    throw error;

}


// ==========================================
// USER
// ==========================================

const myUsername =
    user.username || "User";


// ==========================================
// SOCKET
// ==========================================

const socket =
    io({
        auth: {
            token: token
        },

        transports: [
            "websocket",
            "polling"
        ]
    });


// ==========================================
// CHAT STATE
// ==========================================

let currentPartner =
    null;

let connectedToPartner =
    false;

let currentRoomId =
    null;

let messageSending =
    false;


// ==========================================
// PARTNER UI
// ==========================================

function setChatPartner(
    partner
) {

    if (
        typeof partner ===
        "string"
    ) {

        currentPartner = {
            id:
                window.currentPartnerUserId ||
                null,

            username:
                partner
        };

    } else {

        currentPartner =
            partner || null;

    }


    const username =
        currentPartner
            ? currentPartner.username
            : null;


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

            topPartner.textContent =
                username;

        }


        if (headerPartner) {

            headerPartner.textContent =
                username;

        }


        connectedToPartner =
            true;


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


        connectedToPartner =
            false;


        updateEmptyState(
            false
        );

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


    if (
        !title ||
        !text
    ) {

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

setChatPartner(
    null
);

window.currentPartnerUserId =
    null;

window.currentRoomId =
    null;


// ==========================================
// DISPLAY MESSAGE
// ==========================================

function displayMessage(
    data
) {

    if (!data) {

        return;

    }


    const container =
        document.getElementById(
            "messages"
        );


    if (!container) {

        console.error(
            "messages container not found"
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
        document.createElement(
            "div"
        );

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
        document.createElement(
            "div"
        );

    name.className =
        "name";

    name.textContent =
        data.username ||
        "User";


    const time =
        document.createElement(
            "span"
        );

    time.className =
        "time";


    if (data.time) {

        time.textContent =
            new Date(
                data.time
            ).toLocaleTimeString(
                [],
                {
                    hour:
                        "2-digit",

                    minute:
                        "2-digit"
                }
            );

    }


    name.appendChild(
        time
    );


    const text =
        document.createElement(
            "div"
        );

    text.className =
        "text";

    text.textContent =
        data.message ||
        "";


    message.appendChild(
        name
    );

    message.appendChild(
        text
    );


    // Report button
    if (
        String(data.userId) !==
        String(user.id)
    ) {

        const reportButton =
            document.createElement(
                "button"
            );

        reportButton.className =
            "reportButton";

        reportButton.textContent =
            "🚨 Report";


        reportButton.addEventListener(
            "click",
            () => {

                reportMessage(
                    data.id
                );

            }
        );


        message.appendChild(
            reportButton
        );

    }


    container.appendChild(
        message
    );


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


        container.innerHTML =
            "";


        if (
            !Array.isArray(messages) ||
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
                                ? `You're connected with ${escapeHTML(currentPartner.username)}`
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

                displayMessage(
                    message
                );

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

        console.log(
            "📩 MESSAGE RECEIVED:",
            data
        );


        displayMessage(
            data
        );

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
            "messageInput not found"
        );

        return;

    }


    const message =
        input.value.trim();


    if (!message) {

        return;

    }


    // Socket check
    if (
        !socket.connected
    ) {

        alert(
            "Socket is not connected. Please refresh the page."
        );

        console.error(
            "Socket disconnected"
        );

        return;

    }


    // Partner check
    if (
        !connectedToPartner ||
        !currentPartner ||
        !currentRoomId
    ) {

        alert(
            "Please wait until you are connected to another user."
        );

        console.error(
            "Chat state invalid:",
            {
                connected:
                    connectedToPartner,

                partner:
                    currentPartner,

                roomId:
                    currentRoomId
            }
        );

        return;

    }


    if (
        messageSending
    ) {

        return;

    }


    messageSending =
        true;


    console.log(
        "📤 SENDING MESSAGE:",
        message
    );

    console.log(
        "Socket:",
        socket.id
    );

    console.log(
        "Room:",
        currentRoomId
    );

    console.log(
        "Partner:",
        currentPartner
    );


    socket.emit(
        "chatMessage",
        {
            message:
                message
        },

        response => {

            messageSending =
                false;


            console.log(
                "Server acknowledgement:",
                response
            );


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


            input.value =
                "";

            input.focus();

        }
    );


    // Safety timeout
    setTimeout(
        () => {

            messageSending =
                false;

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


        alert(
            message
        );

    }
);


// ==========================================
// SOCKET CONNECT
// ==========================================

socket.on(
    "connect",
    () => {

        console.log(
            "✅ SOCKET CONNECTED:",
            socket.id
        );


        socket.emit(
            "getCurrentRoom"
        );

    }
);


// ==========================================
// SOCKET DISCONNECT
// ==========================================

socket.on(
    "disconnect",
    reason => {

        console.warn(
            "❌ SOCKET DISCONNECTED:",
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
            "❌ SOCKET CONNECTION ERROR:",
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
            "This account is already open in another tab or device. Please close the other session."
        );


        socket.disconnect(
            true
        );

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

            setChatPartner(
                null
            );

            currentRoomId =
                null;

            window.currentRoomId =
                null;

            window.currentPartnerUserId =
                null;

            return;

        }


        currentRoomId =
            data.roomId;


        window.currentRoomId =
            data.roomId;


        window.currentPartnerUserId =
            data.partner.id;


        currentPartner = {

            id:
                data.partner.id,

            username:
                data.partner.username

        };


        connectedToPartner =
            true;


        setChatPartner(
            currentPartner
        );


        console.log(
            "Partner:",
            currentPartner
        );

        console.log(
            "Partner ID:",
            window.currentPartnerUserId
        );

        console.log(
            "Room:",
            currentRoomId
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
            "⏳ WAITING:",
            data
        );


        currentPartner =
            null;

        currentRoomId =
            null;

        connectedToPartner =
            false;


        window.currentPartnerUserId =
            null;

        window.currentRoomId =
            null;


        setChatPartner(
            null
        );

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


        currentPartner =
            null;

        currentRoomId =
            null;

        connectedToPartner =
            false;


        window.currentPartnerUserId =
            null;

        window.currentRoomId =
            null;

        setChatPartner(
            null
        );

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


        currentPartner =
            null;

        currentRoomId =
            null;

        connectedToPartner =
            false;


        window.currentPartnerUserId =
            null;

        window.currentRoomId =
            null;


        setChatPartner(
            null
        );


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


        currentPartner =
            null;

        currentRoomId =
            null;

        connectedToPartner =
            false;


        window.currentPartnerUserId =
            null;

        window.currentRoomId =
            null;


        setChatPartner(
            null
        );

    }
);


// ==========================================
// SKIP
// ==========================================

function skipUser() {

    if (
        !connectedToPartner
    ) {

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
        typeof window.endVideoCall ===
        "function"
    ) {

        try {

            window.endVideoCall();

        } catch (error) {

            console.log(
                "Video cleanup:",
                error
            );

        }

    }


    socket.emit(
        "skipUser"
    );


    currentPartner =
        null;

    currentRoomId =
        null;

    connectedToPartner =
        false;


    window.currentPartnerUserId =
        null;

    window.currentRoomId =
        null;


    setChatPartner(
        null
    );

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
                    method:
                        "POST",

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
// ESCAPE HTML
// ==========================================

function escapeHTML(
    value
) {

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
// VIDEO CALL
// ==========================================

function startVideoCall() {

    if (
        !currentPartner
    ) {

        alert(
            "You are not connected to another user."
        );

        return;

    }


    if (
        typeof window.callUser !==
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


    window.callUser(
        window.currentPartnerUserId,
        "video"
    );

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
// DEBUG
// ==========================================

function getChatDebugInfo() {

    return {

        socketConnected:
            socket.connected,

        socketId:
            socket.id,

        currentRoomId:
            currentRoomId,

        partner:
            currentPartner,

        partnerUserId:
            window.currentPartnerUserId,

        connectedToPartner:
            connectedToPartner

    };

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
    " NICHE CHAT.JS LOADED"
);

console.log(
    "================================"
);
