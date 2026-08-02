async function addStrike(db, userId) {

    const user =
        db.data.users.find(
            u => u.id === userId
        );

    if (!user) {
        return null;
    }


    user.strikes =
        (user.strikes || 0) + 1;


    let bannedUntil = null;

    // 3 strikes = 10 minute ban

    if (user.strikes >= 3) {

        bannedUntil =
            Date.now() + (10 * 60 * 1000);

        user.bannedUntil =
            bannedUntil;

        user.strikes = 0;

    }


    await db.write();


    return {
        strikes: user.strikes,
        bannedUntil: bannedUntil
    };

}


function isBanned(user) {

    if (!user.bannedUntil) {
        return false;
    }


    if (
        user.bannedUntil <= Date.now()
    ) {

        user.bannedUntil = null;

        return false;

    }


    return true;

}


module.exports = {
    addStrike,
    isBanned
};
