// ==========================================
// NICHE CONNECT - VIDEO CALL
// ==========================================

"use strict";

console.log(
    "VIDEO.JS: loading..."
);

const videoSocket =
    window.chatSocket;

if (!videoSocket) {
    console.error(
        "VIDEO.JS: CampusChat socket is not available."
    );
}

let localStream = null;
let peerConnection = null;

let currentCallId = null;
let currentTargetUserId = null;

let isCaller = false;
let pendingCandidates = [];

const ICE_SERVERS = {
    iceServers: [
        {
            urls:
                "stun:stun.l.google.com:19302"
        },
        {
            urls:
                "stun:stun1.l.google.com:19302"
        }
    ]
};

function getElement(id) {
    return document.getElementById(id);
}

function showCallPanel() {
    const panel =
        getElement("callPanel");

    if (panel) {
        panel.style.display = "flex";
    }
}

function hideCallPanel() {
    const panel =
        getElement("callPanel");

    if (panel) {
        panel.style.display = "none";
    }
}

function setCallStatus(text) {
    const status =
        getElement("callStatus");

    if (status) {
        status.textContent = text;
    }
}

function createPeerConnection() {
    if (peerConnection) {
        return peerConnection;
    }

    peerConnection =
        new RTCPeerConnection(
            ICE_SERVERS
        );

    peerConnection.onicecandidate =
        event => {
            if (
                !event.candidate ||
                !currentTargetUserId ||
                !videoSocket
            ) {
                return;
            }

            videoSocket.emit(
                "ice-candidate",
                {
                    targetUserId:
                        currentTargetUserId,
                    candidate:
                        event.candidate,
                    callId:
                        currentCallId
                }
            );
        };

    peerConnection.ontrack =
        event => {
            const remoteVideo =
                getElement("remoteVideo");

            if (!remoteVideo) {
                return;
            }

            if (
                event.streams &&
                event.streams[0]
            ) {
                remoteVideo.srcObject =
                    event.streams[0];

                remoteVideo.play()
                    .catch(() => {});
            }

            setCallStatus(
                "Connected"
            );
        };

    peerConnection.onconnectionstatechange =
        () => {
            if (!peerConnection) {
                return;
            }

            console.log(
                "WebRTC state:",
                peerConnection.connectionState
            );

            if (
                peerConnection.connectionState ===
                "connected"
            ) {
                setCallStatus(
                    "Connected"
                );
            }

            if (
                peerConnection.connectionState ===
                    "failed" ||
                peerConnection.connectionState ===
                    "disconnected"
            ) {
                setCallStatus(
                    "Connection lost"
                );
            }
        };

    peerConnection.oniceconnectionstatechange =
        () => {
            if (!peerConnection) {
                return;
            }

            console.log(
                "ICE state:",
                peerConnection.iceConnectionState
            );
        };

    peerConnection.onsignalingstatechange =
        () => {
            if (peerConnection) {
                console.log(
                    "Signaling state:",
                    peerConnection.signalingState
                );
            }
        };

    return peerConnection;
}

async function getLocalStream() {
    if (localStream) {
        return localStream;
    }

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        throw new Error(
            "Camera and microphone are not available. Use HTTPS or localhost."
        );
    }

    localStream =
        await navigator.mediaDevices.getUserMedia(
            {
                video: {
                    facingMode: "user",
                    width: {
                        ideal: 1280
                    },
                    height: {
                        ideal: 720
                    }
                },
                audio: true
            }
        );

    const localVideo =
        getElement("localVideo");

    if (localVideo) {
        localVideo.srcObject =
            localStream;

        localVideo.muted = true;
        localVideo.playsInline = true;

        try {
            await localVideo.play();
        } catch (error) {
            console.log(
                "Local video autoplay:",
                error
            );
        }
    }

    return localStream;
}

function addLocalTracks() {
    if (
        !peerConnection ||
        !localStream
    ) {
        return;
    }

    const senders =
        peerConnection.getSenders();

    localStream
        .getTracks()
        .forEach(track => {
            const alreadyAdded =
                senders.some(
                    sender =>
                        sender.track ===
                        track
                );

            if (!alreadyAdded) {
                peerConnection.addTrack(
                    track,
                    localStream
                );
            }
        });
}

async function callUser(
    targetUserId,
    callType = "video"
) {
    try {
        if (!targetUserId) {
            alert(
                "Unable to find the other user."
            );
            return;
        }

        if (!videoSocket) {
            throw new Error(
                "Socket connection is not available."
            );
        }

        currentTargetUserId =
            targetUserId;

        isCaller = true;

        showCallPanel();

        setCallStatus(
            "Opening camera..."
        );

        await getLocalStream();

        createPeerConnection();
        addLocalTracks();

        setCallStatus(
            "Calling..."
        );

        videoSocket.emit(
            "call-user",
            {
                targetUserId,
                callType
            }
        );
    } catch (error) {
        console.error(
            "Unable to start video call:",
            error
        );

        setCallStatus(
            "Camera error"
        );

        alert(
            error.message ||
            "Unable to access camera or microphone."
        );

        cleanupCall();
    }
}

videoSocket &&
videoSocket.on(
    "incoming-call",
    async data => {
        console.log(
            "Incoming call:",
            data
        );

        if (!data) {
            return;
        }

        currentCallId =
            data.callId || null;

        currentTargetUserId =
            data.callerId ||
            data.userId ||
            null;

        const callerName =
            data.callerUsername ||
            data.username ||
            "Someone";

        const accepted =
            confirm(
                `${callerName} is calling you. Accept video call?`
            );

        if (!accepted) {
            videoSocket.emit(
                "reject-call",
                {
                    callId:
                        currentCallId,
                    targetUserId:
                        currentTargetUserId
                }
            );

            cleanupCall();
            return;
        }

        try {
            showCallPanel();

            setCallStatus(
                "Opening camera..."
            );

            await getLocalStream();

            createPeerConnection();
            addLocalTracks();

            setCallStatus(
                "Connecting..."
            );

            videoSocket.emit(
                "answer-call",
                {
                    callId:
                        currentCallId,
                    targetUserId:
                        currentTargetUserId
                }
            );
        } catch (error) {
            console.error(
                "Incoming call error:",
                error
            );

            alert(
                error.message ||
                "Unable to access camera."
            );

            cleanupCall();
        }
    }
);

videoSocket &&
videoSocket.on(
    "call-accepted",
    async data => {
        console.log(
            "Call accepted:",
            data
        );

        try {
            if (data && data.callId) {
                currentCallId =
                    data.callId;
            }

            if (!peerConnection) {
                createPeerConnection();
                addLocalTracks();
            }

            const offer =
                await peerConnection.createOffer();

            await peerConnection.setLocalDescription(
                offer
            );

            videoSocket.emit(
                "offer",
                {
                    targetUserId:
                        currentTargetUserId,
                    callId:
                        currentCallId,
                    offer
                }
            );

            setCallStatus(
                "Connecting..."
            );
        } catch (error) {
            console.error(
                "Offer error:",
                error
            );

            setCallStatus(
                "Call failed"
            );
        }
    }
);

videoSocket &&
videoSocket.on(
    "offer",
    async data => {
        try {
            console.log(
                "Received offer"
            );

            if (!data) {
                return;
            }

            currentCallId =
                data.callId ||
                currentCallId;

            currentTargetUserId =
                data.callerId ||
                data.userId ||
                currentTargetUserId;

            if (!peerConnection) {
                createPeerConnection();
                addLocalTracks();
            }

            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(
                    data.offer
                )
            );

            for (
                const candidate
                of pendingCandidates
            ) {
                try {
                    await peerConnection.addIceCandidate(
                        candidate
                    );
                } catch (error) {
                    console.error(
                        "Queued ICE error:",
                        error
                    );
                }
            }

            pendingCandidates = [];

            const answer =
                await peerConnection.createAnswer();

            await peerConnection.setLocalDescription(
                answer
            );

            videoSocket.emit(
                "answer",
                {
                    targetUserId:
                        currentTargetUserId,
                    callId:
                        currentCallId,
                    answer
                }
            );

            setCallStatus(
                "Connecting..."
            );
        } catch (error) {
            console.error(
                "Offer handling error:",
                error
            );

            setCallStatus(
                "Call failed"
            );
        }
    }
);

videoSocket &&
videoSocket.on(
    "answer",
    async data => {
        try {
            console.log(
                "Received answer"
            );

            if (
                !peerConnection ||
                !data ||
                !data.answer
            ) {
                return;
            }

            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(
                    data.answer
                )
            );

            for (
                const candidate
                of pendingCandidates
            ) {
                try {
                    await peerConnection.addIceCandidate(
                        candidate
                    );
                } catch (error) {
                    console.error(
                        "ICE queue error:",
                        error
                    );
                }
            }

            pendingCandidates = [];

            setCallStatus(
                "Connected"
            );
        } catch (error) {
            console.error(
                "Answer handling error:",
                error
            );

            setCallStatus(
                "Call failed"
            );
        }
    }
);

videoSocket &&
videoSocket.on(
    "ice-candidate",
    async data => {
        try {
            if (
                !data ||
                !data.candidate
            ) {
                return;
            }

            const candidate =
                new RTCIceCandidate(
                    data.candidate
                );

            if (
                peerConnection &&
                peerConnection.remoteDescription
            ) {
                await peerConnection.addIceCandidate(
                    candidate
                );
            } else {
                pendingCandidates.push(
                    candidate
                );
            }
        } catch (error) {
            console.error(
                "ICE candidate error:",
                error
            );
        }
    }
);

videoSocket &&
videoSocket.on(
    "call-rejected",
    () => {
        alert(
            "The other user rejected the video call."
        );

        cleanupCall();
    }
);

videoSocket &&
videoSocket.on(
    "call-ended",
    () => {
        setCallStatus(
            "Call ended"
        );

        cleanupCall();
    }
);

videoSocket &&
videoSocket.on(
    "call-error",
    message => {
        console.error(
            "Call error:",
            message
        );

        alert(
            message ||
            "Unable to start video call."
        );

        cleanupCall();
    }
);

videoSocket &&
videoSocket.on(
    "partner-left",
    () => {
        cleanupCall();
    }
);

function toggleMute() {
    if (!localStream) {
        return;
    }

    const audioTracks =
        localStream.getAudioTracks();

    if (!audioTracks.length) {
        return;
    }

    audioTracks.forEach(track => {
        track.enabled =
            !track.enabled;
    });

    const button =
        getElement("muteButton");

    if (button) {
        button.textContent =
            audioTracks[0].enabled
                ? "🎤"
                : "🔇";
    }
}

function toggleCamera() {
    if (!localStream) {
        return;
    }

    const videoTracks =
        localStream.getVideoTracks();

    if (!videoTracks.length) {
        return;
    }

    videoTracks.forEach(track => {
        track.enabled =
            !track.enabled;
    });

    const button =
        getElement("cameraButton");

    if (button) {
        button.textContent =
            videoTracks[0].enabled
                ? "📷"
                : "🚫";
    }
}

function endVideoCall(notifyServer = true) {
    console.log(
        "Ending video call"
    );

    if (
        notifyServer &&
        videoSocket &&
        currentTargetUserId
    ) {
        videoSocket.emit(
            "end-call",
            {
                targetUserId:
                    currentTargetUserId,
                callId:
                    currentCallId
            }
        );
    }

    cleanupCall();
}

function cleanupCall() {
    console.log(
        "Cleaning video call"
    );

    if (peerConnection) {
        try {
            peerConnection.close();
        } catch (error) {
            console.log(error);
        }

        peerConnection = null;
    }

    if (localStream) {
        localStream
            .getTracks()
            .forEach(track => {
                try {
                    track.stop();
                } catch (error) {
                    console.log(error);
                }
            });

        localStream = null;
    }

    const localVideo =
        getElement("localVideo");

    const remoteVideo =
        getElement("remoteVideo");

    if (localVideo) {
        localVideo.srcObject = null;
    }

    if (remoteVideo) {
        remoteVideo.srcObject = null;
    }

    currentCallId = null;
    currentTargetUserId = null;
    isCaller = false;
    pendingCandidates = [];

    hideCallPanel();

    setCallStatus("Ready");
}

window.callUser = callUser;
window.endVideoCall = endVideoCall;
window.toggleMute = toggleMute;
window.toggleCamera = toggleCamera;

console.log(
    "VIDEO.JS: loaded successfully"
);
