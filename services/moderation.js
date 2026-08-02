// CampusChat moderation system

const blockedWords = [
    "badword1",
    "badword2",
    "badword3"
];

function normalizeMessage(message) {

    return message
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

}

function containsBlockedWord(message) {

    const normalized =
        normalizeMessage(message);

    const words =
        normalized.split(" ");

    return words.some(
        word => blockedWords.includes(word)
    );

}

module.exports = {
    containsBlockedWord
};
