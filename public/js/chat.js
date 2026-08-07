
// ============================================================
// NICHE CONNECT - CHAT.JS
// ============================================================

"use strict";

console.log("CHAT.JS LOADING...");

// ============================================================
// AUTH
// ============================================================

const token = localStorage.getItem("campuschat_token");

if (!token) {
    console.warn("No authentication token found.");
}

// ============================================================
// SOCKET.IO
// ============================================================

let socket = null;

try {
    socket = io({
        auth: {
            token: token
        },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
    });
} catch (error) {
    console.error("Socket.IO initialization failed:", error);
}

// Make socket available globally
window.socket = socket;


// ============================================================
// CURRENT USER / PARTNER STATE
// ============================================================

window.currentRoomId = null;

window.currentPartner = null;

window.currentPartnerUserId = null;

window.currentPartnerUsername = null;


// ============================================================
// DOM HELPERS
// ============================================================

function getElement(...ids) {

    for (const id of ids) {

        const element =
            document.getElementById(id);

        if (element) {
            return element;
        }

    }

    return null;
}


// ============================================================
// COMMON CHAT ELEMENTS
// ============================================================

const messageInput =
    getElement(
        "messageInput",
        "message",
        "chatInput",
        "messageText"
    );

const messagesContainer =
    getElement(
        "messages",
        "messagesContainer",
        "chatMessages",
        "messageContainer"
    );

const partnerNameElement =
    getElement(
        "partnerName",
        "chatPartnerName",
        "partnerUsername"
    );

const statusElement =
    getElement(
        "connectionStatus",
        "status",
        "chatStatus"
    );


// ============================================================
// DISPLAY STATUS
// ============================================================

function setStatus(text) {

    if (statusElement) {
        statusElement.textContent = text;
    }

    console.log("STATUS:", text);
}


// ============================================================
// DISPLAY PARTNER
// ============================================================

function updatePartnerUI() {

    if (!window.currentPartner) {
        return;
    }

    const username =
        window.currentPartner.username ||
        "Unknown user";

    if (partnerNameElement) {
        partnerNameElement.textContent =
            username;
    }

    console.log(
        "Partner username:",
        username
    );

    console.log(
        "Partner ID:",
        window.currentPartnerUserId
    );
}


// ============================================================
// MATCHED
// ============================================================
//
// IMPORTANT:
// This is the event that connects the chat partner
// information with video.js.
//

if (socket) {

    socket.on(
        "matched",
        (data) => {

            console.log(
                "================================"
            );

            console.log(
                "MATCHED EVENT RECEIVED"
            );

            console.log(
                "MATCH DATA:",
                data
            );

            console.log(
                "================================"
            );


            if (!data) {

                console.error(
                    "Matched event contained no data."
                );

                return;
            }


            // ------------------------------------------
            // ROOM
            // ------------------------------------------

            window.currentRoomId =
                data.roomId || null;


            // ------------------------------------------
            // PARTNER
            // ------------------------------------------

            window.currentPartner =
                data.partner || null;


            // ------------------------------------------
            // PARTNER ID
            // ------------------------------------------

            if (
                data.partner &&
                data.partner.id !== undefined &&
                data.partner.id !== null
            ) {

                window.currentPartnerUserId =
                    data.partner.id;

            } else {

                window.currentPartnerUserId =
                    null;

            }


            // ------------------------------------------
            // PARTNER USERNAME
            // ------------------------------------------

            if (
                data.partner &&
                data.partner.username
            ) {

                window.currentPartnerUsername =
                    data.partner.username;

            } else {

                window.currentPartnerUsername =
                    null;

            }


            console.log(
                "Current room:",
                window.currentRoomId
            );

            console.log(
                "Current partner:",
                window.currentPartner
            );

            console.log(
                "Current partner ID:",
                window.currentPartnerUserId
            );

            console.log(
                "Current partner username:",
                window.currentPartnerUsername
            );


            updatePartnerUI();


            setStatus(
                "Connected"
            );


            // ------------------------------------------
            // ENABLE VIDEO BUTTON
            // ------------------------------------------

            const videoButton =
                getElement(
                    "videoCallButton",
                    "startVideoCallButton",
                    "callButton"
                );


            if (videoButton) {

                videoButton.disabled =
                    false;

                videoButton.style.pointerEvents =
                    "auto";

                videoButton.style.opacity =
                    "1";

            }


            // ------------------------------------------
            // ASK SERVER FOR CURRENT ROOM
            // ------------------------------------------

            // Message history can arrive separately,
            // so don't request it here unnecessarily.


        }
    );

}


// ============================================================
// WAITING
// ============================================================

if (socket) {

    socket.on(
        "waiting",
        (data) => {

            console.log(
                "Waiting for partner:",
                data
            );


            window.currentRoomId =
                null;

            window.currentPartner =
                null;

            window.currentPartnerUserId =
                null;

            window.currentPartnerUsername =
                null;


            setStatus(
                data?.message ||
                "Waiting for a new user..."
            );

        }
    );

}


// ============================================================
// NO ROOM
// ============================================================

if (socket) {

    socket.on(
        "noRoom",
        () => {

            console.log(
                "No current room."
            );


            window.currentRoomId =
                null;

            window.currentPartner =
                null;

            window.currentPartnerUserId =
                null;

            window.currentPartnerUsername =
                null;


            setStatus(
                "Waiting for a user..."
            );

        }
    );

}


// ============================================================
// SOCKET CONNECTED
// ============================================================

if (socket) {

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


            setStatus(
                "Connected to server"
            );


            // Ask server whether we already have
            // a room.

            socket.emit(
                "getCurrentRoom"
            );

        }
    );

}


// ============================================================
// SOCKET CONNECT ERROR
// ============================================================

if (socket) {

    socket.on(
        "connect_error",
        (error) => {

            console.error(
                "Socket connection error:",
                error
            );

            setStatus(
                "Connection error"
            );

        }
    );

}


// ============================================================
// SOCKET DISCONNECT
// ============================================================

if (socket) {

    socket.on(
        "disconnect",
        (reason) => {

            console.warn(
                "Socket disconnected:",
                reason
            );

            setStatus(
                "Disconnected"
            );

        }
    );

}


// ============================================================
// PARTNER LEFT
// ============================================================

if (socket) {

    socket.on(
        "partner-left",
        (data) => {

            console.log(
                "Partner left:",
                data
            );


            window.currentRoomId =
                null;

            window.currentPartner =
                null;

            window.currentPartnerUserId =
                null;

            window.currentPartnerUsername =
                null;


            setStatus(
                "Partner disconnected"
            );

        }
    );

}


// ============================================================
// ROOM ENDED
// ============================================================

if (socket) {

    socket.on(
        "room-ended",
        (data) => {

            console.log(
                "Room ended:",
                data
            );


            window.currentRoomId =
                null;

            window.currentPartner =
                null;

            window.currentPartnerUserId =
                null;

            window.currentPartnerUsername =
                null;


            setStatus(
                "Waiting for a new user..."
            );

        }
    );

}


// ============================================================
// MESSAGE HISTORY
// ============================================================

if (socket) {

    socket.on(
        "messageHistory",
        (messages) => {

            console.log(
                "Message history:",
                messages
            );


            if (!Array.isArray(messages)) {
                return;
            }


            if (messagesContainer) {

                messagesContainer.innerHTML =
                    "";

            }


            messages.forEach(
                addMessage
            );

        }
    );

}


// ============================================================
// RECEIVE CHAT MESSAGE
// ============================================================

if (socket) {

    socket.on(
        "chatMessage",
        (message) => {

            console.log(
                "Message received:",
                message
            );

            addMessage(
                message
            );

        }
    );

}


// ============================================================
// CHAT ERROR
// ============================================================

if (socket) {

    socket.on(
        "chatError",
        (message) => {

            console.error(
                "Chat error:",
                message
            );

            alert(
                message
            );

        }
    );

}


// ============================================================
// ADD MESSAGE
// ============================================================

function addMessage(message) {

    if (!messagesContainer) {

        console.warn(
            "Messages container not found."
        );

        return;
    }


    if (!message) {
        return;
    }


    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "message";


    const username =
        document.createElement(
            "div"
        );


    username.className =
        "message-username";


    username.textContent =
        message.username ||
        "User";


    const text =
        document.createElement(
            "div"
        );


    text.className =
        "message-text";


    // textContent prevents HTML injection.
    text.textContent =
        message.message ||
        "";


    wrapper.appendChild(
        username
    );


    wrapper.appendChild(
        text
    );


    messagesContainer.appendChild(
        wrapper
    );


    // Scroll to newest message.

    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;

}


// ============================================================
// SEND MESSAGE
// ============================================================

function sendMessage() {

    if (!socket) {

        alert(
            "Socket connection is not available."
        );

        return;
    }


    if (!socket.connected) {

        alert(
            "Not connected to server."
        );

        return;
    }


    if (
        !window.currentRoomId
    ) {

        alert(
            "You are not connected to a user."
        );

        return;
    }


    if (!messageInput) {

        console.error(
            "Message input not found."
        );

        return;
    }


    const message =
        messageInput.value.trim();


    if (!message) {
        return;
    }


    socket.emit(
        "chatMessage",
        {
            message: message
        }
    );


    messageInput.value =
        "";


    messageInput.focus();

}


// ============================================================
// GLOBAL SEND FUNCTION
// ============================================================

window.sendMessage =
    sendMessage;


// ============================================================
// ENTER TO SEND
// ============================================================

if (messageInput) {

    messageInput.addEventListener(
        "keydown",
        (event) => {

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


// ============================================================
// SKIP USER
// ============================================================

function skipUser() {

    if (!socket) {
        return;
    }


    console.log(
        "Skipping current user..."
    );


    socket.emit(
        "skipUser"
    );


    window.currentRoomId =
        null;

    window.currentPartner =
        null;

    window.currentPartnerUserId =
        null;

    window.currentPartnerUsername =
        null;


    setStatus(
        "Finding a new user..."
    );

}


// ============================================================
// GLOBAL SKIP
// ============================================================

window.skipUser =
    skipUser;


// ============================================================
// START VIDEO CALL
// ============================================================
//
// This function deliberately calls the function exported
// by video.js.
//

function startVideoCall() {

    console.log(
        "Starting video call..."
    );


    console.log(
        "Partner ID:",
        window.currentPartnerUserId
    );


    if (
        !window.currentPartnerUserId
    ) {

        alert(
            "No partner is currently connected."
        );

        console.error(
            "currentPartnerUserId is missing."
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

        console.error(
            "window.callUser is not available."
        );

        return;
    }


    try {

        window.callUser(
            window.currentPartnerUserId,
            "video"
        );

    } catch (error) {

        console.error(
            "Video call error:",
            error
        );

        alert(
            "Unable to start video call."
        );

    }

}


// ============================================================
// GLOBAL VIDEO CALL FUNCTION
// ============================================================

window.startVideoCall =
    startVideoCall;


// ============================================================
// CURRENT ROOM ACCESS
// ============================================================

function getCurrentRoom() {

    if (!socket) {
        return;
    }

    socket.emit(
        "getCurrentRoom"
    );

}


window.getCurrentRoom =
    getCurrentRoom;


// ============================================================
// DEBUG INFORMATION
// ============================================================

window.getChatDebugInfo =
    function () {

        return {

            socketConnected:
                socket
                    ? socket.connected
                    : false,

            socketId:
                socket
                    ? socket.id
                    : null,

            roomId:
                window.currentRoomId,

            partner:
                window.currentPartner,

            partnerUserId:
                window.currentPartnerUserId,

            partnerUsername:
                window.currentPartnerUsername,

            callUser:
                typeof window.callUser

        };

    };


// ============================================================
// FINAL
// ============================================================

console.log(
    "================================"
);

console.log(
    "CHAT.JS LOADED SUCCESSFULLY"
);

console.log(
    "Socket:",
    socket
);

console.log(
    "================================"
);p
