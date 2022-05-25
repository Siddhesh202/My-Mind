const express = require("express");
const path = require('path');
const session = require('express-session');
const User = require("./models/BBY_31_users");
const Chat = require("./models/BBY_31_messages");
const Cart = require("./models/BBY_31_shoppingCarts");
const mongoose = require("mongoose");
const multer = require("multer");
const bcrypt = require('bcrypt');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const nodemailer = require('nodemailer');

app.set('view engine', 'text/html');

if (process.env.NODE_ENV != 'production') {
    require('dotenv').config()
}
mongoose.connect(process.env.DATABASE_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log("connected to db"))
    .catch((err) => console.log(err));

app.use(express.urlencoded({
    extended: true
}));
app.use(express.static(__dirname + '/public'));
app.use(session({
    secret: "password",
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 10800000
    }
}));

//Custom middleware functions
function isLoggedIn(req, res, next) {
    if (req.session.isLoggedIn) {
        return next();
    } else {
        return res.redirect('/login');
    }
}

function isLoggedOut(req, res, next) {
    if (!req.session.isLoggedIn) {
        return next();
    } else {
        return res.redirect('/userprofile');
    }
}

function isAdmin(req, res, next) {
    let userId = req.session.user._id;
    User.findById({
        _id: userId
    }, function (err, user) {
        if (err) console.log(err)
        else if (!user) {
            return res.redirect('/login')
        }
        if (user.userType == 'admin') {
            return next();
        }
        else {
            return res.redirect('/userprofile');
        }
    })
}

function setHeaders(req, res, next) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate"); // HTTP 1.1.
    res.setHeader("Pragma", "no-cache"); // HTTP 1.0.
    res.setHeader("Expires", "0"); // Proxies.
    return next();
}

async function hasRecentlyPurchased(req, res, next) {
    //If a purchase was made in the last 3 mins, render thank-you page
    var currentTime = new Date();
    var nowMinus3Mins = new Date(currentTime.getTime() - 3 * 60000);

    var recentOrderExists = await Cart.exists({
        userId: req.session.user._id,
        status: "completed",
        purchased: {
            $gt: nowMinus3Mins
        }
    })

    if (recentOrderExists) {
        return next();
    } else {
        return res.redirect('/');
    }
}

async function hasActiveSession(req, res, next) {
    var currentTime = new Date();

    var patientActiveSession = await Cart.exists({
        therapist: req.session.user._id,
        status: "completed",
        expiringTime: {
            $gt: currentTime
        }
    })

    console.log(patientActiveSession)
    if (patientActiveSession) {
        return next();
    } else {
        return res.redirect('/');
    }
}

async function isTherapistAvailable(req, res, next) {
    console.log(req.body.therapistID)
    var currentTime = new Date();
    let orderExists = await Cart.exists({
        therapist: req.body.therapistID,
        status: "completed",
        expiringTime: {
            $gt: currentTime
        }
    })
    console.log(orderExists)
    if (orderExists) {
        return res.json({
            errorMsg: "Therapist is currently busy. Please delete him from your cart or wait until they become available again."
        });
    } else {
        return next();
    }

}

function isPatient(req, res, next) {
    if (req.session.user.userType == 'patient') {
        return next();
    }
    return res.redirect('/');
}

//Routes

//user profile page multer to update/change/fetch profile images
var profileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + file.originalname);
    }
})

var profileUpload = multer({
    storage: profileStorage
})

app.post('/uploadProfile', profileUpload.single('profileFile'), (req, res) => {
    if (req.file) {
        var fileName = req.file.filename;
        var id = req.session.user._id;
        User.updateOne({
            "_id": id
        }, {
            profileImg: "../uploads/" + fileName
        }).then((obj) => {
            console.log('Updated - ' + obj);
        })
    } else {
        return;
    }
});

app.get('/getProfilePicture', (req, res) => {
    var id = req.session.user._id;
    User.findById({
        _id: id
    }, function (err, user) {
        if (user) {
            res.send(user)
        }
    })
})

app.get('/isLoggedIn', (req, res) => {
    res.send(req.session.user);
})

app.get('/', function (req, res) {
    res.sendFile(path.resolve('html/index.html'));
});

app.get('/therapists', function (req, res) {
    res.sendFile(path.resolve('html/therapists.html'));
});

app.get('/chat-session', isLoggedIn, hasActiveSession, function (req, res) {
    res.sendFile(path.resolve('html/chat-session.html'));
});

app.get('/my-patients', isLoggedIn, function (req, res) {
    res.sendFile(path.resolve('html/my-patients.html'));
});

app.get('/checkout', isLoggedIn, isPatient, function (req, res) {
    res.sendFile(path.resolve('html/checkout.html'));
});

app.get('/privacypolicy', function (req, res) {
    res.sendFile(path.resolve('html/privacypolicy.html'));
});

app.get('/termsandconditions', function (req, res) {
    res.sendFile(path.resolve('html/termsandconditions.html'));
});

app.get('/order-history', isLoggedIn, isPatient, function (req, res) {
    res.sendFile(path.resolve('html/order-history.html'));
});

app.get('/thank-you', isLoggedIn, hasRecentlyPurchased, function (req, res) {
    res.sendFile(path.resolve('html/thank-you.html'));
});

app.get("/login", isLoggedOut, setHeaders, (req, res) => {
    res.sendFile(path.resolve('html/login.html'));
});

app.get('/admin-dashboard', isLoggedIn, isAdmin, setHeaders, (req, res) => {
    res.sendFile(path.resolve('html/admin-dashboard.html'))
});

app.get('/getUserInfo', isLoggedIn, setHeaders, (req, res) => {
    let userId = req.session.user._id;
    User.findById({
            _id: userId,
    }, function (err, user) {
        if (err) console.log(err)
        if (user) {
            res.json(user);
        }
    })
})

app.post('/getPatientInfo', isLoggedIn, setHeaders, (req, res) => {
    let userId = req.body._id
    User.findById({
            _id: userId,
    }, function (err, user) {
        if (err) console.log(err)
        if (user) {
            res.json(user);
        }
    })
})

async function therapistHasActiveSession(therapistInfo) {
    var currentTime = new Date();
    let orderExists = await Cart.exists({
        therapist: therapistInfo._id,
        status: "completed",
        expiringTime: {
            $gt: currentTime
        }
    })
    if (orderExists) {
        return true;
    } else {
        return false
    }
}

app.get('/getTherapists', (req, res) => {
    User.find({
        userType: "therapist"
    }, async function (err, user) {
        if (err) console.log(err)
        if (user) {
            var existingSession;
            for (let i = 0; i < user.length; i++) {
                existingSession = await therapistHasActiveSession(user[i])
                if (existingSession) {
                    user.splice(i, 1);
                }
            }
            return res.json(user)
        }
    }).sort({
        numSessions: 'desc'
    })
})

app.post('/login', async (req, res) => {
    User.findOne({
        email: req.body.email.toLowerCase()
    }, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect('/login');
        }
        if (!user) {
            res.json("NoEmailExist");
            console.log('No user with such email.');
        } else {
            return auth(req, res, user);
        }
    });
})

function auth(req, res, user) {
    bcrypt.compare(req.body.password, user.password, function (err, comp) {
        if (err) {
            console.log(err);
            res.redirect('/login');
        } else if (comp === false) {
            console.log("Wrong password");
            res.json("wrongPassword");
        } else {
            req.session.user = user;
            req.session.isLoggedIn = true;
            res.json(user);
        }
    })
}

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.log('Error removing user session data. ', err);
    });
    res.redirect('/login')
})

app.get('/userprofile', isLoggedIn, setHeaders, (req, res) => {
    res.sendFile(path.resolve('html/userprofile.html'))
})

app.get('/edit-account', isLoggedIn, setHeaders, (req, res) => {
    res.sendFile(path.resolve('html/edit-account.html'))
})

app.get("/sign-up", isLoggedOut, setHeaders, (req, res) => {
    res.sendFile(path.resolve('html/sign-up.html'))
})

app.post('/editProfile', isLoggedIn, isNotExisting, async (req, res) => {
    let hashedPassword;
    var pass = req.session.user.password;
    var newpass;
    if (req.body.password == "") {
        newpass = pass;
    } else {
        hashedPassword = await bcrypt.hash(req.body.password, 10);
        newpass = hashedPassword;
    }

    User.updateOne({
        "_id": req.session.user._id
    }, {
        "firstName": req.body.firstname,
        "lastName": req.body.lastname,
        "username": req.body.username,
        "email": req.body.email,
        "phoneNum": req.body.phone,
        "password": newpass,
        "yearsExperience": req.body.yearsExperience,
        "sessionCost": req.body.sessionCost
    })
        .then((obj) => {
            return res.json("updated");
        })
        .catch((err) => {
            console.log('Error: ' + err);
        })
})

async function isNotExisting(req, res, next) {
    var emailExists = await User.exists({
        email: req.body.email
    })
    var phoneExists = await User.exists({
        phoneNum: req.body.phone
    })
    var usernameExists = await User.exists({
        username: req.body.username
    })

    let userId = req.session.user._id;
    User.findById({
        _id: userId
    }, function (err, user) {
        if (err) console.log(err)
        if (user) {
            if (emailExists && req.body.email != user.email) {
                return res.json("existingEmail");
            } else if (phoneExists && req.body.phone != user.phoneNum) {
                return res.json("existingPhone")
            } else if (usernameExists && req.body.username != user.username) {
                return res.json("existingUsername")
            } else {
                return next();
            }
        } else {
            req.session.destroy();
            return res.json("logout");
        }
    })
}

app.post("/sign-up", isNotRegistered, async (req, res) => {
    let userType = (req.body.userType != 'patient' && req.body.userType != 'therapist') ? 'patient' : req.body.userType;
    if (req.body.userType == "therapist") {
        try {
            const hashedPassword = await bcrypt.hash(req.body.password, 10);
            const new_user = new User({
                firstName: req.body.firstname,
                lastName: req.body.lastname,
                username: req.body.username,
                phoneNum: req.body.phone,
                userType: userType,
                yearsExperience: req.body.yearsExperience,
                sessionCost: req.body.sessionCost,
                email: req.body.email,
                password: hashedPassword
            });

            new_user.save()
                .then((result) => {
                    console.log(result);
                    res.json("login");
                });
        } catch (err) {
            console.log("Error while checking if user was already registered. ", err);
            res.redirect('/sign-up');
        }
    } else {
        try {
            const hashedPassword = await bcrypt.hash(req.body.password, 10);
            const new_user = new User({
                firstName: req.body.firstname,
                lastName: req.body.lastname,
                username: req.body.username,
                phoneNum: req.body.phone,
                userType: userType,
                email: req.body.email,
                password: hashedPassword
            });

            new_user.save()
                .then((result) => {
                    console.log(result);
                    res.json("login");
                });
        } catch (err) {
            console.log("Error while checking if user was already registered. ", err);
            res.redirect('/sign-up');
        }
    }
})

async function isNotRegistered(req, res, next) {
    var emailExists = await User.exists({
        email: req.body.email
    })
    var phoneExists = await User.exists({
        phoneNum: req.body.phone
    })
    var usernameExists = await User.exists({
        username: req.body.username
    })
    if (emailExists) {
        return res.json("existingEmail");
    } else if (phoneExists) {
        return res.json("existingPhone")
    } else if (usernameExists) {
        return res.json("existingUsername")
    } else {
        return next();
    }
}

//////Admin Dashboard////////

//MiddleWare

function isNotLastAdminDelete(req, res, next) {
    if (req.body.previousUserType == 'admin') {
        User.count({
            userType: 'admin'
        }, (err, count) => {
            if (err) {
                console.log("Error while checking if user is last admin in db. ", err);
            } else if (count > 1) {
                return next();
            } else {
                return res.send('lastAdmin');
            }
        })
    } else {
        return next();
    }
}

function isNotLastAdminEdit(req, res, next) {
    if (req.body.previousUserType == 'admin' && req.body.userType != 'admin') {
        User.count({
            userType: 'admin'
        }, (err, count) => {
            if (err) {
                console.log("Error while checking if user is last admin in db. ", err);
            } else if (count > 1) {
                return next();
            } else {
                return res.send('lastAdmin');
            }
        })
    } else {
        return next();
    }
}

//Routes

app.get('/getAllUsersData', isLoggedIn, isAdmin, setHeaders, (req, res) => {
    User.find({}, function (err, user) {
        if (err) {
            console.log('Error searching user.', err);
        }
        if (!user) {
            console.log('Database is empty.');
        }
        res.json(user);
    });
})

app.delete('/deleteUser', isLoggedIn, isAdmin, isNotLastAdminDelete, async (req, res) => {
    User.deleteOne({
        _id: req.body.id
    })
        .then(function () {
            //if user is deleting themselves, delete session data
            if (req.body.id == req.session.user._id) {
                req.session.destroy();
            }
            res.send();
        }).catch(function (error) {
            console.log(error); // Failure
        });
})

app.delete('/deleteUserProfile', isLoggedIn, isNotLastAdminDelete, async (req, res) => {
    User.deleteOne({
        _id: req.session.user._id
    })
        .then(function () {
            req.session.destroy();
            res.send();
        }).catch(function (error) {
            console.log(error); // Failure
        });
})

async function isNotExistingAdmin(req, res, next) {
    var emailExists = await User.exists({
        email: req.body.email
    })
    var phoneExists = await User.exists({
        phoneNum: req.body.phone
    })
    var usernameExists = await User.exists({
        username: req.body.username
    })

    let userId = req.body.id;
    User.findById({
        _id: userId
    }, function (err, user) {
        if (err) console.log(err)
        if (user) {
            if (emailExists && req.body.email != user.email) {
                return res.send("existingEmail");
            } else if (phoneExists && req.body.phone != user.phoneNum) {
                return res.send("existingPhone")
            } else if (usernameExists && req.body.username != user.username) {
                return res.send("existingUsername")
            } else {
                return next();
            }
        } else {
            res.send("unexistingUser")
        }
    })
}

app.put('/editUser', isLoggedIn, isAdmin, isNotExistingAdmin, isNotLastAdminEdit, (req, res) => {
    if (req.body.password != "") {
        return updateUserWithPassword(req, res);
    }
    if (req.body.userType == "therapist") {
        User.updateOne({
            "_id": req.body.id
        }, {
            "firstName": req.body.firstname,
            "lastName": req.body.lastname,
            "username": req.body.username,
            "email": req.body.email,
            "phoneNum": req.body.phone,
            "userType": req.body.userType,
            "yearsExperience": req.body.yearsExperience,
            "sessionCost": req.body.sessionCost
        })
            .then((obj) => {
                if (req.session.user._id == req.body.id && req.body.userType != req.session.user.userType)
                    req.session.destroy();
                return res.send("updatedWithoutPassword");
            })
            .catch((err) => {
                console.log('Error: ' + err);
            })
    } else {
        User.updateOne({
            "_id": req.body.id
        }, {
            $unset: {
                "yearsExperience": "",
                "sessionCost": ""
            },
            "firstName": req.body.firstname,
            "lastName": req.body.lastname,
            "username": req.body.username,
            "email": req.body.email,
            "phoneNum": req.body.phone,
            "userType": req.body.userType
        })
            .then((obj) => {
                if (req.session.user._id == req.body.id && req.body.userType != req.session.user.userType)
                    req.session.destroy();
                return res.send("updatedWithoutPassword");
            })
            .catch((err) => {
                console.log('Error: ' + err);
            })
    }
})

async function updateUserWithPassword(req, res) {
    var hashedPassword = await bcrypt.hash(req.body.password, 10);
    if (req.body.userType == "therapist") {
        User.updateOne({
            "_id": req.body.id
        }, {
            "firstName": req.body.firstname,
            "lastName": req.body.lastname,
            "username": req.body.username,
            "email": req.body.email,
            "phoneNum": req.body.phone,
            "userType": req.body.userType,
            "yearsExperience": req.body.yearsExperience,
            "sessionCost": req.body.sessionCost,
            "password": hashedPassword
        })
            .then((obj) => {
                if (req.session.user._id == req.body.id && req.body.userType != req.session.user.userType)
                    req.session.destroy();
                return res.send("updatedWithPassword");
            })
            .catch((err) => {
                console.log('Error: ' + err);
            })
    } else {
        User.updateOne({
            "_id": req.body.id
        }, {
            $unset: {
                "yearsExperience": "",
                "sessionCost": ""
            },
            "firstName": req.body.firstname,
            "lastName": req.body.lastname,
            "username": req.body.username,
            "email": req.body.email,
            "phoneNum": req.body.phone,
            "userType": req.body.userType,
            "password": hashedPassword
        })
            .then((obj) => {
                if (req.session.user._id == req.body.id && req.body.userType != req.session.user.userType)
                    req.session.destroy();
                return res.send("updatedWithPassword");
            })
            .catch((err) => {
                console.log('Error: ' + err);
            })
    }
}

app.post("/createUser", isLoggedIn, isAdmin, isNotRegistered, async (req, res) => {
    if (req.body.userType == "therapist") {
        try {
            const hashedPassword = await bcrypt.hash(req.body.password, 10);
            const new_user = new User({
                firstName: req.body.firstname,
                lastName: req.body.lastname,
                username: req.body.username,
                phoneNum: req.body.phone,
                userType: req.body.userType,
                yearsExperience: req.body.yearsExperience,
                sessionCost: req.body.sessionCost,
                email: req.body.email,
                password: hashedPassword
            });

            new_user.save()
                .then((result) => {
                    console.log(result);
                    res.json("login");
                });
        } catch (err) {
            console.log("Error while checking if user was already registered. ", err);
            res.redirect('/sign-up');
        }
    } else {
        try {
            const hashedPassword = await bcrypt.hash(req.body.password, 10);
            const new_user = new User({
                firstName: req.body.firstname,
                lastName: req.body.lastname,
                username: req.body.username,
                phoneNum: req.body.phone,
                userType: req.body.userType,
                email: req.body.email,
                password: hashedPassword
            });

            new_user.save()
                .then((result) => {
                    console.log(result);
                    res.json("login");
                });
        } catch (err) {
            console.log("Error while checking if user was already registered. ", err);
            res.redirect('/sign-up');
        }
    }
})

//Checkout

app.post('/addToCart', isLoggedIn, async (req, res) => {
    //Check if there is already something in cart
    var cartExists = await Cart.exists({
        userId: req.session.user._id,
        status: "active"
    })
    if (cartExists) {
        return res.send("cartExists");
    }

    //Check if user has a current valid session with another therapist
    var currentTime = new Date();
    var orderExists = await Cart.exists({
        userId: req.session.user._id,
        status: "completed",
        expiringTime: {
            $gt: currentTime
        }
    })
    if (orderExists) {
        console.log("Something exists")
        return res.send("orderExists");
    }

    const new_cart = new Cart({
        orderId: "MM" + Math.floor((Math.random() * 1500000000) + 1000000000),
        therapist: req.body.therapist,
        userId: req.session.user._id,
        status: "active"
    });

    new_cart.save()
        .then((result) => {
            console.log(result);
        });

    res.send();

})

app.get('/checkStatus', isLoggedIn, (req, res) => {
    Cart.findOne({
        userId: req.session.user._id,
        status: "active"
    }, function (err, cart) {
        if (err) {
            console.log('Error searching cart.', err);
        }
        if (!cart) {
            res.send();
        } else {
            res.json(cart);
        }
    });
})

app.post('/getTherapistInfo', isLoggedIn, (req, res) => {
    var therapistInfo;
    User.findById({
        _id: req.body.therapistId
    }, function (err, user) {
        if (err) console.log(err)

        if (!user) {
            return res.redirect('/')
        }
        else {
            therapistInfo = {
                firstName: user.firstName,
                lastName: user.lastName,
                yearsExperience: user.yearsExperience,
                sessionCost: user.sessionCost,
                profileImg: user.profileImg
            }
            res.json(therapistInfo);
        }
    })
})

app.delete('/deleteCart', isLoggedIn, async (req, res) => {
    Cart.updateOne({
        userId: req.session.user._id,
        status: "active"
    }, {
        status: "deleted"
    }).then((obj) => {
        console.log("deleted");
        res.send()
    }).catch(function (error) {
        console.log(error);
    })
})

// MiddleWare for checkout
async function usedTrial(req, res, next) {
    var trialStatus;
    if (req.body.cartPlan == "freePlan") {
        trialStatus = await User.exists({
            _id: req.session.user._id,
            usedTrial: true
        })
    }
    if (trialStatus) {
        return res.json({
            errorMsg: "You have already used your free trial."
        });
    } else {
        return next();
    }
}

async function sendEmails(userId, therapistId, cartInfo) {
    const transporter = nodemailer.createTransport({
        service: 'hotmail',
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS
        }
    });

    let patientInfo = await User.findById({ _id: userId });
    let therapistInfo = await User.findById({ _id: therapistId });

    const mailPatient = {
        from: process.env.MAIL_USER,
        to: patientInfo.email,
        subject: 'Thank you for purchasing a session with MyMind!',
        // text: `We have activated a therapy session with ${therapistInfo.firstName} ${therapistInfo.lastName}. Your session will expire at ${new Date(cartInfo.expiringTime).toLocaleString('en-CA', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true })}, and you can view your cart history at our Order History page at any time! We hope you have a wonderful session, thank you for your time and support.`
        html: `<img src="https://imgur.com/2id2jly"><h1>DOLLARS DOLLARS!</h1><p>We have activated a therapy session with ${therapistInfo.firstName} ${therapistInfo.lastName}. Your session will expire at ${new Date(cartInfo.expiringTime).toLocaleString('en-CA', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true })}, and you can view your cart history at our Order History page at any time! We hope you have a wonderful session, thank you for your time and support.</p>`,
    //     attachments: [{
    //         filename: 'image.png',
    //         path: '/path/to/file',
    //         cid: 'unique@kreata.ee' //same cid value as in the html img src
    //     }]
    // }
    };
    transporter.sendMail(mailPatient, function (err, info) {
        if (err) console.log(err)
        else console.log('Email sent to patient');
    });

    let sessionLength;
    if (cartInfo.timeLength == 'yearPlan') sessionLength = 15;
    else if (cartInfo.timeLength == 'threeMonthPlan') sessionLength = 10;
    else if (cartInfo.timeLength == 'monthPlan') sessionLength = 5;
    else sessionLength = 3;

    // email to therapist -- timeout because hotmail has a limit of requests/second
    setTimeout(() => {
        const mailTherapist = {
            from: process.env.MAIL_USER,
            to: therapistInfo.email,
            subject: 'You have a new patient waiting for you!',
            text: `Your patient, ${patientInfo.firstName} ${patientInfo.lastName} has purchased a session with you for ${sessionLength} mins and is waiting to chat! Please get in contact with him as soon as possible!`
        }
        transporter.sendMail(mailTherapist, function (err, info) {
            if (err) console.log(err)
            else console.log('Email sent to therapist');
        });
    }, 1500);
}

app.post('/confirmCart', isLoggedIn, usedTrial, isTherapistAvailable, (req, res) => {
    const currentDate = Date.now();
    Cart.findOneAndUpdate({
        userId: req.session.user._id,
        status: "active"
    }, {
        status: "completed",
        $set: {
            purchased: currentDate,
            expiringTime: req.body.timeLengthforUse,
            cost: req.body.totalPrice
        }
    }, { new: true }).then((cart) => {
        console.log("Updated Cart");
        sendEmails(req.session.user._id, req.body.therapistID, cart)
        incrementTherapistSessionNum(req.session.user._id);
        res.send(cart);
    }).catch(function (error) {
        console.log(error);
    })

    if (req.body.cartPlan == 'freePlan') {
        User.updateOne({
            _id: req.session.user._id
        }, {
            usedTrial: true
        }).then((obj) => {
            console.log("User used their free trial!");
        }).catch(function (error) {
            console.log(error);
        })
    }
})

function incrementTherapistSessionNum(userID) {
    Cart.find({
        userId: userID,
        status: "completed"
    }, function (err, carts) {
        if (err) {
            console.log('Error searching cart.', err);
        }
        if (carts) {
            const sortedCart = carts.sort((a, b) => b.purchased - a.purchased)
            var therapistID = sortedCart[0].therapist
            User.updateOne({
                _id: therapistID
            }, {
                $inc: {
                    numSessions: 1
                }
            }).then(() => {
                console.log('Incremented number of sessions for therapist.')
            }).catch(function (error) {
                console.log(error);
            })
        }
    });
}

app.put('/updateCart', isLoggedIn, async (req, res) => {
    Cart.updateOne({
        userId: req.session.user._id,
        status: "active"
    }, {
        timeLength: req.body.timeLength
    }).then((obj) => {
        res.send(obj)
    }).catch(function (error) {
        console.log(error);
    })
})

app.get('/getPreviousPurchases', isLoggedIn, (req, res) => {
    Cart.find({
        userId: req.session.user._id,
        $or: [{
            status: "completed",
        }, {
            status: "refunded",
        }]
    }, function (err, carts) {
        if (err) {
            console.log('Error searching cart.', err);
        }
        if (carts) {
            res.json(carts);
        }
    });
})

app.get('/getPreviousPatients', isLoggedIn, (req, res) => {
    Cart.find({
        therapist: req.session.user._id,
        $or: [{
            status: "completed",
        }, {
            status: "refunded",
        }]
    }, function (err, carts) {
        if (err) {
            console.log('Error searching cart.', err);
        }
        if (carts) {
            res.json(carts);
        }
    });
})

app.get('/recentPurchase', isLoggedIn, (req, res) => {
    Cart.find({
        userId: req.session.user._id,
        status: "completed"
    }, function (err, carts) {
        if (err) {
            console.log('Error searching cart.', err);
        }
        if (carts) {
            const sortedCart = carts.sort((a, b) => b.purchased - a.purchased)
            return res.json(sortedCart[0])
        }
    });
})

app.get('/activeSession', isLoggedIn, (req, res) => {
    var currentTime = new Date();
    Cart.find({
        userId: req.session.user._id,
        status: "completed",
        expiringTime: {
            $gt: currentTime
        }
    }, function (err, carts) {
        if (err) {
            console.log('Error searching cart.', err);
        }
        if (carts.length > 0) {
            console.log(carts)
            const sortedCart = carts.sort((a, b) => b.purchased - a.purchased);
            var therapistName;
            var errorMessageVariables;
            User.findOne({
                _id: sortedCart[0].therapist
            }, function (err, user) {
                if (err) console.log(err)
                if (user) {
                    therapistName = user.firstName + " " + user.lastName
                    errorMessageVariables = {
                        cost: sortedCart[0].cost,
                        purchased: sortedCart[0].expiringTime,
                        therapistName: therapistName
                    };
                    return res.json(errorMessageVariables)
                }
            })
        } else {
            return res.json("NoActiveSession");
        }
    })
})

app.post('/refundOrder', isLoggedIn, (req, res) => {
    var currentTime = new Date();
    Cart.updateOne({
        userId: req.session.user._id,
        status: "completed",
        expiringTime: {
            $gt: currentTime
        }
    }, {
        expiringTime: currentTime,
        status: "refunded"
    }).then((obj) => {
        res.send(obj)
    }).catch(function (error) {
        console.log(error);
    })
})


//Live Chat
//record ids of users connected to a room
let users = [];

//Creates connection between server and client
io.on('connection', (socket) => {
    var userId;
    var orderID;

    socket.on("chat message", function (msg, room) {

        //console.log('message:', msg, ' to room:', room);

        //broadcast message to everyone in port:8000 except yourself.
        socket.to(room).emit("chat message", { message: msg });

        //save chat to the database
        let connect = mongoose.connect(process.env.DATABASE_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        })
        connect.then(db => {
            let chatMessage = new Chat({
                message: msg,
                sender: userId,
                orderId: orderID
            });

            chatMessage.save();
        });

    });

    socket.on("join-room", function (room, senderId) {
        socket.join(room);
        console.log('connected to room', room);
        orderID = room;
        userId = senderId;
        users.push(senderId);
        socket.to(room).emit("connected", senderId)
    })

    socket.on('disconnect', () => {
        if(!userId) return;
  
        var index = users.indexOf(userId);
        users.splice(index, 1);

        let newIndex = users.indexOf(userId);
        if (newIndex == -1){
            socket.to(orderID).emit("disconnected")
        }
    })

    socket.on('check-status', (otherId, callback) => {
        if(!otherId) return;
  
        var index = users.indexOf(otherId);
        if (index > -1){
            callback();
        }
    })

});

app.get('/activeChatSession', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.json('notLoggedIn');
    }
    var currentTime = new Date();
    Cart.findOne({
        $or: [{
            userId: req.session.user._id,
        }, {
            therapist: req.session.user._id,
        }],
        status: "completed",
        expiringTime: {
            $gt: currentTime
        }
    }, function (err, carts) {
        if (err) {
            console.log('Error searching cart.', err);
        }
        if (carts) {
            // console.log(carts)

            var orderId = carts.orderId;
            var purchased = carts.expiringTime;
            var therapistId = carts.therapist;
            var userId = carts.userId;
            var chatInfo;
            User.findOne({
                _id: req.session.user._id
            }, function (err, user) {
                if (err) console.log(err)
                if (user) {
                    if (user.userType == 'therapist') {
                        User.findOne({
                            _id: userId
                        }, function (err, user) {
                            if (err) console.log(err)
                            if (user) {
                                chatInfo = {
                                    purchased: purchased,
                                    orderId: orderId,
                                    therapistId: therapistId,
                                    userId: userId,
                                    name: user.firstName + " " + user.lastName,
                                    phone: user.phoneNum,
                                    image: user.profileImg,
                                    sender: therapistId,
                                    currentId: req.session.user._id,
                                    other: userId
                                };
                                return res.json(chatInfo)

                            }
                        })
                    } else {
                        User.findOne({
                            _id: therapistId
                        }, function (err, user) {
                            if (err) console.log(err)
                            if (user) {
                                chatInfo = {
                                    purchased: purchased,
                                    orderId: orderId,
                                    therapistId: therapistId,
                                    userId: userId,
                                    name: user.firstName + " " + user.lastName,
                                    phone: user.phoneNum,
                                    image: user.profileImg,
                                    sender: userId,
                                    currentId: req.session.user._id,
                                    other: therapistId
                                };
                                return res.json(chatInfo)

                            }
                        })
                    }


                } else {
                    return res.json("InvalidUser")
                }

            })
        } else {
            return res.json("NoActiveSession");
        }
    })
})

app.post('/loadMsgs', function (req, res) {
    console.log(req.body.orderId);
    Chat.find({
        orderId: req.body.orderId
    }, function (err, chats) {
        if (err) {
            console.log('Error searching cart.', err);
        }
        if (chats) {
            res.json(chats);
        }
    }).sort({
        createdAt: 'asc'
    });

})

app.get("*",(req, res) => {
    res.sendFile(path.resolve('html/404.html'))
});

server.listen(process.env.PORT || 8000, () => {
    console.log('listening on port:8000');
});
