//***********************************************************
// PiLapseRails
// raspberry Pi powered timelapse controller
// author: Joosep Kõivistik // koivistik.com
// repository: https://github.com/equilerex/PiLapseRails
//***********************************************************



//***********************************************************
// dev mode... set true if windows
var os = require('os')
var windowsDevEnvironment = os.platform() === "win32"; 

//***********************************************************
// Dummy / demo function to test on windows, uncomment to test
//***********************************************************
var gpio = {
    "read": function (nr, state) {
        console.log("read pin " + gpio.definitions[nr])
    },
    "open": function (nr, state, func) {
        console.log("opened pin " + gpio.definitions[nr])
        func()
    },
    "close": function (nr, state, func) {
        console.log("stop " + gpio.definitions[nr])
    },
    "write": function (nr, state, func) {
        console.log(gpio.definitions.state[state]+" "+gpio.definitions[nr])
        func()
    },
    "definitions": {
        11: "focus",
        12: "shutter",
        15: "motor forward",
        16: "motor back",
        "state":{
            1:"start",
            0:"stop"
        }
    }
};
//normal pin plugin
if(!windowsDevEnvironment) {
    var gpio = require("pi-gpio")
}



//***********************************************************
// node setup
//***********************************************************
var express = require('express')
    , app = express()
    , server = require('http').createServer(app)
    , path = require('path')
    //websocket connection
    , io = require('socket.io').listen(server)
    , spawn = require('child_process').spawn
    ,exec = require('child_process').exec
    //pin accesss
    //saving settings locally
    , fs = require('fs');
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'ejs');
app.set('port', process.env.TEST_PORT || 8080);
//set default route
/* GET home page. */
app.get('/', function(req, res, next) {
    res.render(path.join(__dirname, '../public/app/views/index'), {  root: path.join(__dirname, '../public/'), "absoluteUrl":req.headers.host});
});

//make files accessible in public folder
app.use("/public", express.static(path.join(__dirname, '../public')));





//***********************************************************
// pin configuration (feel free to change) using values from here: https://github.com/rakeshpai/pi-gpio
//***********************************************************
var pinConf = {
    "focus": 11,
    "shutter": 12,
    "forward": 15,
    "back": 16
};


fs.readFile(path.join(__dirname, '../public/app/railconf.json'), 'utf8', function (err, savedRailconf) {

});

//***********************************************************
// Status feedback
//***********************************************************
var railStatus = {
    "currentPosition":0,
    "lapseInProgress":false,
    "forward":false,
    "back":false,
    "count":0
};

var serverRailConf = false;
var serverLapseConf = false;

//***********************************************************
// get saved settings
//***********************************************************
fs.readFile(path.join(__dirname, '../public/app/railconf.json'), 'utf8', function (err, savedRailconf) {
    fs.readFile(path.join(__dirname, '../public/app/lapseconf.json'), 'utf8', function (err2, savedLapseconf) {
        if (savedLapseconf && savedLapseconf.length > 0) {
            //store for socket connections
            serverLapseConf = JSON.parse(savedLapseconf);
        }
        if (savedRailconf && savedRailconf.length > 0) {
            //store for socket connections
            serverRailConf = JSON.parse(savedRailconf);
            //if position should be remembered on boot, restore it.
            if(serverRailConf.rememberPosition && serverRailConf.savedPosition) {
                railStatus.currentPosition = serverRailConf.savedPosition
            }
        };
    });

});
//***********************************************************
//open pins for business
//***********************************************************
var openErr = false;
var openCount = 0;
var openPins = function() {
    //failsafe
    openCount+=1
    var markError = function(err) {
        if(err) {
            openErr = true
        }
    };
    gpio.open(pinConf.focus,    "output", function (err) {markError()});
    gpio.open(pinConf.shutter,  "output", function (err) {markError()});
    gpio.open(pinConf.forward,  "output", function (err) {markError()});
    gpio.open(pinConf.back,     "output", function (err) {markError()});
    //if outdated session then opening nodes that are open already produces error
    setTimeout(function () {
        if (openErr && openCount < 5) {
            console.log("try to close and open pins")
                gpio.close(pinConf.focus);
                gpio.close(pinConf.shutter);
                gpio.close(pinConf.forward);
                gpio.close(pinConf.back);
                openErr = false;

            setTimeout(function () {
                openPins()
            },2000);
        }
    },2000)
};
openPins();

//***********************************************************
// if you want to save position on boot
//***********************************************************
var railMoved = function() {
    if(serverRailConf.rememberPosition) {
        serverRailConf.savedPosition = railStatus.currentPosition;
        console.log(serverRailConf.savedPosition)
        fs.writeFile(path.join(__dirname, '../public/app/railconf.json'), JSON.stringify(serverRailConf), "utf8", function (err) {});
    }
};

//***********************************************************
// cancel active timelapse
//***********************************************************
var stopTimelapse = function(lapseConf) {
    lastMotorStop = new Date().getTime();
    clearTimeout(focusEvent);
    clearTimeout(shutterEvent);
    clearTimeout(engineEvent);
    clearTimeout(intetvalEvent);
    clearTimeout(intetvalEvent2);


    gpio.write(pinConf.shutter, 0, function () {});
    gpio.write(pinConf.focus, 0, function () {});
    gpio.write(pinConf.forward, 0, function () {});
    gpio.write(pinConf.back, 0, function () {});


    // if stop was in the middle of a motor run, add that in the status
    if(lastMotorStart) {
        var motorRun = lastMotorStop - lastMotorStart;
        if (lapseConf.direction === true) {
            railStatus.currentPosition += parseInt(motorRun)
        } else if (lapseConf.direction === false) {
            railStatus.currentPosition -= parseInt(motorRun)
        }
    }
    //update status
    railStatus.lapseInProgress = false;
    delete railStatus.loopCount;
    //save state
    railMoved();
    plr.emit("timelapseStatus", railStatus);
};


//***********************************************************
// Running timelapse logic
//***********************************************************
//set timeout values
var focusEvent
    ,shutterEvent
    ,engineEvent
    ,intetvalEvent
    ,intetvalEvent2;

//in case motor is stopped, we need the new locaton
var lastMotorStart;
var lastMotorStop;
var runTimeLapse = function(data) {
    //shots left is static per session
    railStatus.shotsLeft = data.railStatus.shotsLeft;
    //make a local copy
    railStatus.loopCount = data.lapseConf.loopCount;
    //select right gpio pin for motor direction
    var motorGpio = pinConf.forward;
    var selectMotorPin = function(){
        if (!data.lapseConf.direction) {
            motorGpio = pinConf.back;
        } else {
            motorGpio = pinConf.forward
        }
    };
    selectMotorPin();

    //save new settings locally
    fs.writeFile(path.join(__dirname, '../public/app/lapseconf.json'), JSON.stringify(data.lapseConf), "utf8", function (err) {});


    //set shutter speed default length if bulb disabled
    if (!data.lapseConf.bulbMode) {
        data.lapseConf.shutterSpeed = 0
    }
    //single shot cycle
    var shutterCycle = function () {
        //trigger focus & wait for focus length
        gpio.write(pinConf.focus, 1, function () {
            focusEvent = setTimeout(function () {
                //trigger shutter & wait for shutter speed if any
                gpio.write(pinConf.shutter, 1, function () {
                    shutterEvent = setTimeout(function () {
                        //release shutter / focus
                        gpio.write(pinConf.shutter, 0, function () {});
                        gpio.write(pinConf.focus, 0, function () {});
                        //update status
                        railStatus.count = railStatus.count+1;
                        plr.emit("timelapseStatus", railStatus);
                        //half of "wait" before engine, half after in order to stabilize the rails
                        intetvalEvent = setTimeout(function () {
                            //if loop enabled and end of rails, switch direction
                            if(data.lapseConf.loopEnabled && railStatus.loopCount>0) {

                                if (data.lapseConf.direction && railStatus.currentPosition <= data.railConf.railLength - data.lapseConf.motorPulse || !data.lapseConf.direction && railStatus.currentPosition >= data.lapseConf.motorPulse) {
                                    //ignore
                                } else {
                                    //count loop
                                    railStatus.loopCount -=1;
                                    //switch direction
                                    data.lapseConf.direction = !data.lapseConf.direction;
                                    //switch pins
                                    selectMotorPin();
                                }
                            }
                           //trigger motor if theres still room for it
                            if (data.lapseConf.direction && railStatus.currentPosition <= data.railConf.railLength - data.lapseConf.motorPulse || !data.lapseConf.direction && railStatus.currentPosition >= data.lapseConf.motorPulse) {
                                gpio.write(motorGpio, 1, function () {
                                    //log start time
                                    lastMotorStart = new Date().getTime();
                                    //stop motor
                                    engineEvent = setTimeout(function () {
                                        lastMotorStart = false;
                                        gpio.write(motorGpio, 0, function () {});
                                        //calculate new position
                                        if (data.lapseConf.direction === true) {
                                            railStatus.currentPosition += parseInt(data.lapseConf.motorPulse)
                                        } else if (data.lapseConf.direction === false) {
                                            railStatus.currentPosition -= parseInt(data.lapseConf.motorPulse)
                                        }
                                        plr.emit("timelapseStatus", railStatus);
                                        //wait til interval finishes before shooting again
                                        intetvalEvent2 = setTimeout(function () {
                                            //restart cycle
                                            shutterCycle()
                                        }, data.lapseConf.waitLength / 2);
                                    }, data.lapseConf.motorPulse);
                                });
                            } else {
                                stopTimelapse(data.lapseConf);
                            }
                        }, data.lapseConf.waitLength / 2);
                    }, data.lapseConf.shutterSpeed)
                })
            }, data.lapseConf.focusLength)
        });
    };

    //trigger the cycle for the first time
    shutterCycle();
    //update status
    railStatus.lapseInProgress = true;
    railStatus.count = 0;
    plr.emit("timelapseStatus", railStatus);
};

//***********************************************************
// manual rail slide
//***********************************************************
var timer;
var manualDirection = false;
var updateStopWatch = function() {
    if(manualDirection==="forward") {
        railStatus.currentPosition += 100;
    } else {
        railStatus.currentPosition -= 100;
    }
    plr.emit("timelapseStatus", railStatus);
    timer = setTimeout(function() {
        updateStopWatch()
    }, 100);
};
var runManualSlide = function(data) {
    //clear states
    gpio.write(pinConf.forward, 0, function () {});
    gpio.write(pinConf.back, 0, function () {});
    //start motor if needed
    railStatus[data.direction] = data.state
    if (data.state) {
        railStatus.lapseInProgress = true;
        gpio.write(pinConf[data.direction], 1, function () {});
        manualDirection = data.direction;
        updateStopWatch();
    } else {
        railStatus.lapseInProgress = false;
        manualDirection = false;
        clearTimeout(timer);
        //save state
        railMoved();
        plr.emit("timelapseStatus", railStatus);
    }
};




//***********************************************************
// Socket.io Congfig
//***********************************************************
server.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});
//Save the Screen Socket in this variable
var plr;
//***********************************************************
// Socket listener events
//***********************************************************
io.sockets.on('connection', function (socket) {
    //device connected
    socket.on("pageLoaded", function () {
        plr = socket;
        //If there are saved values from last session, send them to frontend
        fs.readFile(path.join(__dirname, '../public/app/railconf.json'), 'utf8', function (err, savedRailconf) {
            fs.readFile(path.join(__dirname, '../public/app/lapseconf.json'), 'utf8', function (err2, savedLapseconf) {
                var data = {
                    "lapseConf":false,
                    "railConf":false
                };
                if (serverLapseConf) {
                    //pass saved config to frontend
                    data.lapseConf = serverLapseConf;
                }
                if (serverRailConf) {
                    //pass saved config to frontend
                    data.railConf = serverRailConf
                }
                //send current status
                plr.emit("connectionEstablished", data);
                plr.emit("timelapseStatus", railStatus);
            });

        });
    });

    //saving shot settings call
    socket.on("saveSettings", function (data) {
        //in remember enabled, save status right away
        if(data.file === "railconf") {
            var temp = data.data.rememberPosition
            serverRailConf = data.data
            if(data.data.rememberPosition && !temp) {
                railMoved()
            }
        }
        fs.writeFile(path.join(__dirname, '../public/app/'+data.file+'.json'), JSON.stringify(data.data), "utf8", function (err) {
            if(data.file === "railconf") {
                plr.emit("settingsSaved", data);
            }
        });
    });
    //running timelapse call
    socket.on("runTimelapse", function (conf) {
        runTimeLapse(conf)
    });
    // cancel active timelapse call
    socket.on("cancelTimelapse", function (data) {
        stopTimelapse(data)
    });
    //manual slide call
    socket.on("manualSlide", function (data) {
        runManualSlide(data)
    });
    //update position
    socket.on("resetPosition", function (data) {
        railStatus.currentPosition = 0;
    });

    //shut down
    socket.on("shutOffPi", function (data) {
        exec("sudo shutdown -h now", function (error, stdout, stderr) {
            return;
        });
    });

    //test shot
    socket.on("testShot", function (data) {
        gpio.write(pinConf.focus, 1, function () {
            focusEvent = setTimeout(function () {
                //trigger shutter & wait for shutter speed if any
                gpio.write(pinConf.shutter, 1, function () {
                    shutterEvent = setTimeout(function () {
                        //release shutter / focus
                        gpio.write(pinConf.shutter, 0, function () {});
                        gpio.write(pinConf.focus, 0, function () {});
                    }, data.lapseConf.shutterSpeed)
                })
            }, data.lapseConf.focusLength)
        });
    });

});