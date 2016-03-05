var windowsDevEnvironment = false

//***********************************************************
// Dummy / demo function to test on windows, uncomment to test
//***********************************************************
var gpio = {
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
// Socket.io Congfig
//***********************************************************
io.set('log level', 1);
server.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});
//Save the Screen Socket in this variable
var plr;



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
// Socket runtime logic
//***********************************************************
io.sockets.on('connection', function (socket) {
    //device connected
    socket.on("pageLoaded", function (data) {
        plr = socket;

        //If there are saved values from last session, send them to frontend
        fs.readFile('public/savedsettings.json', 'utf8', function (err, data) {
            if (data && data.length > 0) {
                //pass saved config to frontend
                plr.emit("connectionEstablished", {
                    "timelapseVariables": data
                });
            } else {
                //no saved conf  -> use default
                plr.emit("connectionEstablished", {
                    "timelapseVariables": false
                });
            }
            //send current status
            plr.emit("timelapseStatus", railStatus);
        });
    });
    //***********************************************************
    // Clean up pin states (ensure there is no conflicts)
    //***********************************************************
    gpio.read(pinConf.focus, function(err, value) {
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
    gpio.close(pinConf.back);

    //open pins for business
    gpio.open(pinConf.focus,    "output", function () {});
    gpio.open(pinConf.shutter,  "output", function () {});
    gpio.open(pinConf.forward,  "output", function () {});
    gpio.open(pinConf.back,     "output", function () {});

    //***********************************************************
    // Running timelapse logic
    //***********************************************************
    socket.on("runTimelapse", function (conf) {
        //interval that doesnt include motor, shutter or focus
        var shutterDelay = conf.interval - conf.motorPulse - conf.focusLength;

        //select right gpio pin for motor direction
        var motorGpio = pinConf.forward;
        if (!conf.direction) {
            motorGpio = pinConf.back;
        }

        //save new settings locally
        fs.writeFile('public/savedsettings.json', JSON.stringify(conf), "utf8", function () {
        });

        //handle focus pin (needed or not?)
        var focusState = 0;
        if (conf.focusEnabled) {
            focusState = 1
        } else {
            conf.focusLength = 0;
        }

        //set shutter speed default length if bulb disabled
        if (!conf.bulbMode) {
            conf.shutterSpeed = 0
        }

        //in case motor is stopped, we need the ew locaton
        var lastMotorStart;
        var lastMotorStop;

        //set timeout values
        var focusEvent
            ,shutterEvent
            ,engineEvent
            ,intetvalEvent
        //manual stop
        var stopTimelapse = function() {
            var lastMotorStop = new Date().getTime();
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
                if (conf.direction === true) {
                    railStatus.currentPosition += parseInt(motorRun)
                } else if (conf.direction === false) {
                    railStatus.currentPosition -= parseInt(motorRun)
                }
            }
            //update status
            railStatus.lapseInProgress = false;
            plr.emit("timelapseStatus", railStatus);
        };
        //***********************************************************
        // cancel active timelapse
        //***********************************************************
        socket.on("cancelTimelapse", function (data) {
            stopTimelapse()
        });



        //single shot cycle
        var shutterCycle = function () {
            //trigger focus & wait for focus length
            gpio.write(pinConf.focus, focusState, function () {
                focusEvent = setTimeout(function () {
                    //trigger shutter & wait for shutter speed if any
                    gpio.write(pinConf.shutter, focusState, function () {
                        shutterEvent = setTimeout(function () {
                            //release shutter / focus
                            gpio.write(pinConf.shutter, 0, function () {});
                            gpio.write(pinConf.focus, 0, function () {});
                            //update status
                            railStatus.count = railStatus.count+1;
                            plr.emit("timelapseStatus", railStatus);
                            //trigger motor if theres still room for it
                            if (conf.direction && railStatus.currentPosition <= conf.railLength - conf.motorPulse || !conf.direction && railStatus.currentPosition >= conf.motorPulse) {
                                gpio.write(motorGpio, 1, function () {
                                    //log start time
                                    var lastMotorStart = new Date().getTime();
                                    //stop motor
                                    engineEvent = setTimeout(function () {
                                        var lastMotorStart = false;
                                        gpio.write(motorGpio, 0, function () {});
                                        //calculate new position
                                        if (conf.direction === true) {
                                            railStatus.currentPosition += parseInt(conf.motorPulse)
                                        } else if (conf.direction === false) {
                                            railStatus.currentPosition -= parseInt(conf.motorPulse)
                                        }
                                        console.log(railStatus.lapseInProgress)
                                        plr.emit("timelapseStatus", railStatus);
                                        //wait til interval finishes before shooting again
                                        intetvalEvent = setTimeout(function () {
                                            //restart cycle
                                            shutterCycle()
                                        }, shutterDelay);
                                    }, conf.motorPulse);
                                });
                            } else {
                                //stop if end reached
                                stopTimelapse();
                            }

                        }, conf.shutterSpeed)
                    })
                }, conf.focusLength)
            });
        };

        //trigger the cycle for the first time
        shutterCycle();
        //update status
        railStatus.lapseInProgress = true;
        railStatus.count = 0;
        plr.emit("timelapseStatus", railStatus);


    });



    //***********************************************************
    // manual rail slide
    //***********************************************************
    socket.on("manualSlide", function (data) {
        //clear states
        gpio.write(pinConf.forward, 0, function () {});
        gpio.write(pinConf.back, 0, function () {});
        //start motor if needed
        if (data.state) { 
            gpio.write(pinConf[data.direction], 1, function () {});
        }
    });

    //***********************************************************
    // reset original settings in case data becomes corrupt
    //***********************************************************
    socket.on("saveSettings", function (data) {
        fs.writeFile('public/savedsettings.json', JSON.stringify(data), "utf8", function () {
        });
    });
});