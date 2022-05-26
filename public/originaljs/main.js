$(document).ready(function () {
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.getElementById('nav-toggle');
    const navClose = document.getElementById('nav-close');
    const navLink = document.querySelectorAll('.nav-link');
    var socket = io();
    var orderId;
    const chatExpiredModal = document.getElementById('chatExpiredModal');

    // Load the Navbar and Footer 
    loadNavbarFooter();

    function patientNavbarSetup() {
        var patientEls = document.querySelectorAll(".isPatient");
        for (var x = 0; x < patientEls.length; x++)
            patientEls[x].style.display = 'list-item';
    }

    function therapistNavbarSetup() {
        let therapistEls = document.querySelectorAll(".isTherapist");
        for (var x = 0; x < therapistEls.length; x++)
            therapistEls[x].style.display = 'list-item';
    }

    function adminNavbarSetup() {
        let adminEls = document.querySelectorAll(".isAdmin");
        for (var x = 0; x < adminEls.length; x++)
            adminEls[x].style.display = 'list-item';
    }

    function loggedInNavbarSetup() {
        let loggedInEls = document.querySelectorAll(".isLoggedIn");
        for (var x = 0; x < loggedInEls.length; x++)
            loggedInEls[x].style.display = 'list-item';
    }

    function loggedOutNavbarSetup() {
        let loggedOutEls = document.querySelectorAll(".isLoggedOut")
        for (var x = 0; x < loggedOutEls.length; x++)
            loggedOutEls[x].style.display = 'list-item';
    }

    setTimeout(() => {
        $.get('/isLoggedIn', function (user) {
            if (user) {
                loggedInNavbarSetup()
                if (user.userType == 'patient') {
                    patientNavbarSetup()
                } else if (user.userType == 'therapist') {
                    therapistNavbarSetup();
                } else if (user.userType == 'admin') {
                    adminNavbarSetup()
                }
                setTimeout(() => {
                    $('.logout-link').click(function () {
                        console.log('clicked')
                        $.post('/logout');
                        window.location = '/login'
                    })
                }, 400);
            } else {
                loggedOutNavbarSetup();
            }
        })

    }, 50);

    // Display hashed password for signup and login form
    displayPassword();

    /* Show Menu */
    // Validation if constant var exists
    if (navToggle) {
        navToggle.addEventListener('click', function () {
            navMenu.classList.add('show-menu');
        });
    }

    /* Hide Menu */
    // Validation if constant var exists
    if (navClose) {
        navClose.addEventListener('click', function () {
            navMenu.classList.remove('show-menu');
        });
    }


    // Load the Navbar and Footer 
    function loadNavbarFooter() {
        $('#navPlaceHolder').load('../headerfooter/nav.html', function () {
            // For mobile nav links
            $('.nav-item .nav-link').each(function () {
                $(this).toggleClass('active', this.getAttribute('href') === location.pathname);
            });
            // For mobile nav icons
            $('.nav-link .nav-icon').each(function () {
                $(this).toggleClass('active', this.getAttribute('href') === location.pathname);
            });

            // For desktop nav links
            $('.navLinks a').each(function () {
                $(this).toggleClass('active', this.getAttribute('href') === location.pathname);
            });
        });
        $('#footerPlaceHolder').load('../headerfooter/footer.html');
        $('#therapistChat').load('../headerfooter/chatbox.html');
    }

    // Display hashed password for signup and login form
    function displayPassword() {
        $("#show-hide-password .input-group-addon a").on('click', function (event) {
            event.preventDefault();
            if ($('#show-hide-password input').attr("type") == "text") {
                $('#show-hide-password input').attr('type', 'password');
                $('#show-hide-password .input-group-addon a i').addClass("fa-eye-slash");
                $('#show-hide-password .input-group-addon a i').removeClass("fa-eye");
            } else if ($('#show-hide-password input').attr("type") == "password") {
                $('#show-hide-password input').attr('type', 'text');
                $('#show-hide-password .input-group-addon a i').removeClass("fa-eye-slash");
                $('#show-hide-password .input-group-addon a i').addClass("fa-eye");
            }
        });
    }

    // Remove Menu Mobile
    function linkAction() {
        // When clicked on each nav link, remove the show menu class
        document.getElementById('nav-menu').classList.remove('show-menu');
    }

    navLink.forEach(n => n.addEventListener('click', linkAction));

    function loadMsgs(data) {
        $.ajax({
            url: '/loadMsgs',
            type: 'POST',
            data: {
                orderId: data.orderId
            },
            success: function (chats) {
                chats.forEach(function (element) {
                    let msgClass = (data.currentId == element.sender) ? 'self' : 'other';
                    var messagesContainer = $('#chatMessages');
                    messagesContainer.append([
                        `<li class="${msgClass}" data-before="Sent at ${new Date(element.createdAt).toLocaleString('en-CA', { hour: 'numeric', minute: 'numeric', hour12: true })}">`,
                        element.message,
                        '</li>'
                    ].join(''));
                })
            }
        })
    }

    function socketSetup(data) {
        socket.emit('join-room', data.orderId, data.sender);
        socket.emit('check-status', data.other, function () {
            changeActiveState('Online')
        });

        socket.on("chat message", (msg) => {
            var messagesContainer = $('#chatMessages');
            messagesContainer.append([
                `<li class="other" data-before="Sent at ${new Date().toLocaleString('en-CA', { hour: 'numeric', minute: 'numeric', hour12: true })}">`,
                msg.message,
                '</li>'
            ].join(''));
        });

        socket.on('connected', function (connectedId) {
            if (connectedId != data.currentId)
                changeActiveState('Online');
        })

        socket.on('disconnected', function () {
            changeActiveState('Offline');
        })

    }

    // check active session
    $.get('/activeChatSession', function (data) {
        if (data == "NoActiveSession" || data == "notLoggedIn") {
            $('#therapistChat').hide();
        } else {
            let therapistEls = document.querySelectorAll(".hasActiveSession");
            for (var x = 0; x < therapistEls.length; x++)
                therapistEls[x].style.display = 'list-item';
            if (window.location.pathname != '/chat-session' && document.body.clientWidth < 992) {
                $('#therapistChat').hide();
            } else {
                $('#therapistChat').css('display', 'flex');
                loadMsgs(data);
                chatSetup();
                orderId = data.orderId;
                socketSetup(data);
                $("#chatName").text(`${data.name}`)
                $("#chatPhone").attr("href", `tel:${data.phone}`)
                $("#chatImg").attr("src", `${data.image}`)
            }
        }
    })



    // Get and display session expiring time
    setInterval(getSessionEndTime, 1000);

    function getSessionEndTime() {
        $.get('/activeChatSession', function (data) {
            if (data != "NoActiveSession" && data != "notLoggedIn") {
                var currDate = new Date();
                var expiringDate = new Date(data.purchased);
                var diffTime = Math.abs((expiringDate.getTime() - currDate.getTime()) / 1000);
                var diffHours = Math.floor(diffTime / 3600) % 24;
                diffTime -= diffHours * 3600;
                var diffMins = Math.floor(diffTime / 60) % 60;
                diffTime -= diffMins * 60;
                var diffSecs = Math.floor(diffTime % 60);
                if (diffMins == 0 && diffSecs != 0) {
                    $("#sessionTimer").text('Session expires in ' + diffSecs + 's');
                } else if (diffMins == 0 && diffSecs == 0) {
                    $("#sessionTimer").text('Chat ended');
                    var textInput = element.find('#chatbox');
                    textInput.keydown(onMetaAndEnter).prop("disabled", true).focus();
                    document.getElementById('sendMessage').style.backgroundColor = '#858585';
                    chatExpiredModal.style.display = 'block';
                    document.getElementById("closeChatExpired").onclick = function () {
                        chatExpiredModal.style.display = "none";
                        document.body.style.overflow = 'auto';
                    }
                } else {
                    $("#sessionTimer").text('Session expires in ' + diffMins + 'm ' + diffSecs + 's');
                }
            }
        })
    }



    // activityWatcher();

    // function activityWatcher() {
    //     var secondsSinceLastActivity = 0;
    //     var maxInactivity = (10); // 60 * 5

    //     setInterval(function () {
    //         secondsSinceLastActivity++;
    //         console.log(secondsSinceLastActivity + ' seconds since the user was last active');
    //         if (secondsSinceLastActivity > maxInactivity) {
    //             console.log('User has been inactive for more than ' + maxInactivity + ' seconds');
    //             $('#chatActiveState').text('Inactive');
    //         }
    //     }, 1000);

    //     function activity() {
    //         $('#chatActiveState').text('Active Now');
    //         secondsSinceLastActivity = 0;
    //     }

    //     var activityEvents = [
    //         'mousedown', 'mousemove', 'mouseup', 'keydown', 'scroll', 'touchstart',
    //         'click', 'keypress', 'keyup', 'submit', 'change', 'mouseenter', 'resize', 'dblclick'
    //     ];

    //     activityEvents.forEach(function (e) {
    //         document.addEventListener(e, activity, true);
    //     });
    // }

    function chatSetup() {
        // Chat Page for mobile
        if (window.location.pathname == '/chat-session') {
            var element = $('#wrapper');
            var messages = element.find('#chatMessages');
            var userInput = $('#chatbox');
            userInput.keydown(onMetaAndEnter).prop("disabled", false).focus();
            element.find('#sendMessage').click(sendNewMessage);
            messages.scrollTop(messages.prop("scrollHeight"));

            $(document).on('click', '.self, .other', function () {
                $(this).toggleClass('showTime');
            });

            userInput.each(function () {
                this.setAttribute("style", `${this.scrollHeight + 2}px`);
            }).on("input", function () {
                this.style.height = (this.scrollHeight + 2) + "px";
            });
        } else {
            // Chat Box for desktop
            var element = $('#therapistChat');
            element.addClass('enter');
            element.click(openElement);
        }
    }

    function openElement() {
        var element = $('#therapistChat');
        var messages = element.find('#chatMessages');
        var textInput = element.find('#chatbox');
        var userInput = $('#chatbox');
        element.find('>i').hide();
        element.addClass('expand');
        element.find('.chatContainer').addClass('enter');
        textInput.keydown(onMetaAndEnter).prop("disabled", false).focus();
        element.off('click', openElement);
        element.find('#closeChat').click(closeElement);
        element.find('#sendMessage').click(sendNewMessage);
        messages.scrollTop(messages.prop("scrollHeight"));


        $(document).on('click', '.self, .other', function () {
            $(this).toggleClass('showTime');
        });

        userInput.each(function () {
            this.setAttribute("style", `${this.scrollHeight + 2}px`);
        }).on("input", function () {
            this.style.height = (this.scrollHeight + 2) + "px";
        });
    }

    function closeElement() {
        var element = $('#therapistChat');
        element.find('.chatContainer').removeClass('enter').hide();
        element.find('#chatMsgIcon').show();
        element.removeClass('expand');
        element.find('#closeChat').off('click', closeElement);
        element.find('#sendMessage').off('click', sendNewMessage);
        element.find('#chatbox').off('keydown', onMetaAndEnter).prop("disabled", true).blur();
        setTimeout(function () {
            element.find('.chatContainer').removeClass('enter').show()
            element.click(openElement);
        }, 500);
    }

    if (window.location.pathname == '/thank-you') {
        document.getElementById('startSessionBtn').onclick = function () {
            if (document.body.clientWidth >= 992) {
                openElement();
            } else {
                window.location.href = '/chat-session';
            }
        }
    }

    function sendNewMessage() {
        var userInput = $('#chatbox');
        var newMessage = userInput.val().trim();
        if (!newMessage) {
            userInput.focus();
            return;
        }

        socket.emit('chat message', newMessage, orderId);
        var messagesContainer = $('#chatMessages');
        messagesContainer.append([
            `<li class="self" data-before="Sent at ${new Date().toLocaleString('en-CA', { hour: 'numeric', minute: 'numeric', hour12: true })}">`,
            newMessage,
            '</li>'
        ].join(''));

        userInput.val('');
        userInput.focus();

        $('#chatbox').each(function () {
            this.setAttribute("style", `${this.scrollHeight + 5}px`);
        });

        messagesContainer.finish().animate({
            scrollTop: messagesContainer.prop("scrollHeight")
        }, 500);
    }

    function onMetaAndEnter(e) {
        if (e.ctrlKey && e.keyCode == 13) {
            sendNewMessage();
        }
    }

    function changeActiveState(status) {
        activeStates = document.querySelectorAll("#chatActiveState");
        activeStates.forEach(function (element) {
            element.innerHTML = status;
        })
    }
});