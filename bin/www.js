var windowsDevEnvironment = false

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
    //pin accesss
    //saving settings locally
    , fs = require('fs');

app.set('port', process.env.TEST_PORT || 8080);
//set default route
app.get('/', function (req, res) {
    res.sendFile('index.html', {root: path.join(__dirname, '../public')});
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


//***********************************************************
// Clean up pin states (ensure there is no conflicts)
//***********************************************************

//probably not needed
        /*gpio.read(pinConf.focus, function(err, value) {
            console.log(value, err);	// The current state of the pin
        });
        gpio.read(pinConf.shutter, function(err, value) {
            console.log(value, err);	// The current state of the pin
        });
        gpio.read(pinConf.forward, function(err, value) {
            console.log(value, err);	// The current state of the pin
        });
        gpio.read(pinConf.back, function(err, value) {
            console.log(value, err);	// The current state of the pin
        });

        gpio.close(pinConf.focus);
        gpio.close(pinConf.shutter);
        gpio.close(pinConf.forward);
        gpio.close(pinConf.back);*/


//***********************************************************
//open pins for business
//***********************************************************
gpio.open(pinConf.focus,    "output", function () {});
gpio.open(pinConf.shutter,  "output", function () {});
gpio.open(pinConf.forward,  "output", function () {});
gpio.open(pinConf.back,     "output", function () {});


//***********************************************************
// cancel active timelapse
//***********************************************************
var stopTimelapse = function(lapseConf) {
    lastMotorStop = new Date().getTime();
    clearTimeout(focusEvent);
    clearTimeout(shutterEvent);
    clearTimeout(engineEvent);
    clearTimeout(intetvalEvent);

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
    fs.writeFile('public/lapseconf.json', JSON.stringify(data.lapseConf), "utf8", function () {
    });


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
                                    console.log(railStatus.lapseInProgress)
                                    plr.emit("timelapseStatus", railStatus);
                                    //wait til interval finishes before shooting again
                                    intetvalEvent = setTimeout(function () {
                                        //restart cycle
                                        shutterCycle()
                                    }, data.lapseConf.waitLength);
                                }, data.lapseConf.motorPulse);
                            });
                        } else {
                            //if looping, switch direction
                            if(data.lapseConf.loopEnabled && railStatus.loopCount>0) {
                                //count loop
                                railStatus.loopCount -=1;
                                //switch direction
                                data.lapseConf.direction = !data.lapseConf.direction;
                                //switch pins
                                selectMotorPin();
                                shutterCycle();

                            //stop if end reached
                            } else {
                                stopTimelapse(data.lapseConf);
                            }
                        }

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
        plr.emit("timelapseStatus", railStatus);
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
        fs.readFile('public/railconf.json', 'utf8', function (err, savedRailconf) {
            fs.readFile('public/lapseconf.json', 'utf8', function (err2, savedLapseconf) {
                var data = {
                    "lapseConf":false,
                    "railConf":false
                };
                if (savedLapseconf && savedLapseconf.length > 0) {
                    //pass saved config to frontend
                    data.lapseConf = savedLapseconf;
                }
                if (savedRailconf && savedRailconf.length > 0) {
                    //pass saved config to frontend
                    data.railConf = savedRailconf;
                }
                console.log("sssssssssssssssssssss", data)
                //send current status
                plr.emit("connectionEstablished", data);
                plr.emit("timelapseStatus", railStatus);
            });

        });
    });

    //saving shot settings call
    socket.on("saveSettings", function (data) {
        console.log(data)
        fs.writeFile('public/'+data.file+'.json', JSON.stringify(data.data), "utf8", function () {
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
});