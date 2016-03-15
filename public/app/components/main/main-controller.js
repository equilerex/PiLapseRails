//***********************************************************
// PiLapseRails
// raspberry Pi powered timelapse controller
// author: Joosep Kõivistik // koivistik.com
// repository: https://github.com/equilerex/PiLapseRails
//***********************************************************


angular.module("ngapp").controller("MainController", function(shared, $state, $scope, $mdSidenav, $mdComponentRegistry, $timeout,$mdToast, $location){
    //***********************************************************
    // dev mode... set true in www.js and main-controller.js & uncomment http://localhost:8080/public/app/vendor/socket.js  in index.html and comment out src="http://192.168.43.80:8080/public/app/vendor/socket.js
    //***********************************************************
    var windowsDevEnvironment = true; //set true in()

    //***********************************************************
    // settings slide out bar
    //***********************************************************
    var ctrl = this;
    this.auth = shared.info.auth;
    this.toggle = angular.noop;
    this.title = $state.current.title;
    this.isOpen = function() { return false };
    $mdComponentRegistry
    .when("left")
    .then( function(sideNav){
      ctrl.isOpen = angular.bind( sideNav, sideNav.isOpen );
      ctrl.toggle = angular.bind( sideNav, sideNav.toggle );
    });
    this.toggleRight = function() {
    $mdSidenav("left").toggle()
        .then(function(){
        });
    };
    this.close = function() {
    $mdSidenav("right").close()
        .then(function(){
        });
    };
    //close menu when moving back
    $scope.openMenu = function () {
        $location.search("menuOpen", true)
    };
    $scope.$on('$locationChangeStart', function(event, next, current) {
        if(current.split("#")[1]==="/main?menuOpen" && next.split("#")[1]==="/main") {
            if($scope.main.isOpen()) {
                $scope.main.toggle()
            }
        }
    });


    //***********************************************************
    // Available settings / default values
    //***********************************************************
    $scope.defaultLapseConf = {
        "bulbMode":false,
        "shutterSpeed":1000,
        "focusLength":0,
        "motorPulse":1000,
        "waitLength":1000,
        "direction":true, //backward
        "loopEnabled":false,
        "loopCount":0
    };
    $scope.defaultRailConf = {
        "focusEnabled":false,
        "rememberPosition":false
    };
    $scope.railStatus = {
        "shotsLeft":0,
        "timeLeft":0,
        "interval":0
    };
    $scope.lapseConf = {};
    $scope.railConf = {};
    var timeFormats = {
        minute:{
            "human":"min | sec | ms",
            "machine":"mm:ss:SS"
        },
        hour: {
            "human":"hour | min | sec",
            "machine":"HH:mm:ss"
        },
        day: {
            "human":"Days",
            "machine":"day"
        }
    };
    $scope.timeLeftFormat = timeFormats.underHour;
    $scope.intervalFormat =  timeFormats.underHour;


    //***********************************************************
    // progress / calculation feedback
    //***********************************************************
    var loopAddon = function() {
        var loopAddon = 0;
        var count = 0;
        if( $scope.railStatus.loopCount) {
            count = $scope.railStatus.loopCount
        } else {
            count = $scope.lapseConf.loopCount
        }
        if($scope.lapseConf.loopEnabled && count>0) {
            return loopAddon = $scope.railConf.railLength*count;
        } else {
            return 0
        }
    };
    //progress bar
    $scope.loadBar = function() {
        var calculate = ($scope.railStatus.shotsLeft-$scope.railStatus.count)/($scope.railStatus.shotsLeft/100)
        if ($scope.lapseConf.direction) {
            return parseInt(100 - calculate)
        } else {
            return parseInt(calculate)
        }
    };
    //choose the best format for estimates
    var chooseFormat = function(timeType, duration) {

        //select format
        var type = "minute";
        if(duration > 86400000) {
            type ="day"
        } else if(duration > 3600000) {
            type ="hour"
        }
        //save human readable value
        $scope[timeType] = timeFormats[type].human;
        //return value into the source function
        return timeFormats[type].machine;
    };
    //shots calculation
    $scope.shotsLeft =  function() {
        //shots depend on the rail length divided by motor pulse
        var value = 0;
        if($scope.lapseConf.direction) {
            value = parseInt((($scope.railConf.railLength-$scope.railStatus.currentPosition)+loopAddon())/$scope.lapseConf.motorPulse)
        } else {
            value =  parseInt(($scope.railStatus.currentPosition+loopAddon())/$scope.lapseConf.motorPulse)
        }
        //last shot behaves a bit fishy
        if (value > 0) {
            return value + 1
        } else {
            return 0
        }
    };
    //remaining time calculation
    $scope.timeLeft =  function() {
        var timeLeft = $scope.intervalNumber()*$scope.shotsLeft();
        var momentFormat = chooseFormat("timeLeftFormat",timeLeft)
        if(momentFormat === "day") {
            $scope.railStatus.timeLeft =  parseInt(moment.duration(timeLeft).asDays());
        } else {
            $scope.railStatus.timeLeft = moment(moment.duration(timeLeft)._data).format(momentFormat)
        }
    };
    //interval calculation
    $scope.intervalNumber =  function() {
        var interval = 0;
        if($scope.railConf.focusEnabled) {
            interval += parseInt($scope.lapseConf.focusLength)
        }
        if($scope.lapseConf.bulbMode) {
            interval += parseInt($scope.lapseConf.shutterSpeed)
        }
        interval += parseInt($scope.lapseConf.motorPulse);
        interval += parseInt($scope.lapseConf.waitLength);
        return  interval

    };
    //update all calculations
    $scope.updateEstimate = function(){
        var multiply = 0;
        if($scope.railConf.loopEnabled) {
            multiply = $scope.railConf.loopCount
        }
        if(!$scope.railStatus.lapseInProgress) {
            $scope.railStatus.count = 0;
            $scope.railStatus.shotsLeft = $scope.shotsLeft();
        }
        $scope.timeLeft();
        var intervalNumber = $scope.intervalNumber();
        var momentFormat = chooseFormat("intervalFormat",intervalNumber)
        if(momentFormat === "day") {
            $scope.railStatus.interval =  parseInt(moment.duration(intervalNumber).asDays())
        } else {
            $scope.railStatus.interval =  moment(moment.duration(intervalNumber)._data).format(momentFormat);
        }
    };

    //***********************************************************
    //Communicate with Raspberry runtime
    //***********************************************************
    //connect to raspberry data feed
    var socket = "";
    //socket is on current environment (used to switch between dev environment and raspberry)
    var url = window.location.href ;
    var arr = url.split("/");
    var absoluteUrl = arr[0] + "//" + arr[2];
    socket = io.connect(absoluteUrl);
    socket.on("connect_error", function () {
        $scope.$apply(function() {
            $scope.disconnected = true;
        });
    });
    //device has been connected event
    socket.on('connect', function(data){
        socket.emit('pageLoaded');
        $scope.$apply(function() {
            $scope.disconnected = false;
        });
    });
    socket.on("disconnect", function () {
        $scope.$apply(function() {
            $scope.disconnected = true;
        });
    });
    //fetch saved data upon loading
    socket.on('connectionEstablished', function(data){
        //use saved data
        $scope.$apply(function() {
            if (data.railConf) {
                $scope.railConf = data.railConf
                //use default
            } else {
                $scope.railConf = $scope.defaultRailConf
            }
            if (data.lapseConf) {
                $scope.lapseConf = data.lapseConf
                //use default
            } else {
                $scope.lapseConf = $scope.defaultLapseConf
            }
            $timeout(function(){$scope.updateEstimate()},300)
            $scope.connectionEstablished = true;
        });
        $scope.$apply(function() {
            $scope.disconnected = false;
        });
    });
    //active timelapse feedback info
    socket.on('timelapseStatus', function (data) {
        $scope.$apply(function() {
            $scope.railStatus = data;
            $scope.updateEstimate()
        });
    });
    //run the timelapse
    $scope.runTimelapse = function() {
        socket.emit('runTimelapse', {"lapseConf":$scope.lapseConf,"railConf":$scope.railConf, "railStatus":$scope.railStatus});
    };
    //cancel timelapse
    $scope.cancelTimelapse = function(source) {
        socket.emit('cancelTimelapse', {"lapseConf":$scope.lapseConf,"railConf":$scope.railConf});
    };
    //manual move
    $scope.manualSlide = function(direction, state) {
        socket.emit('manualSlide',{direction:direction, state:!state});
    };
    //reset RailConf
    $scope.resetConf = function(file, data) {
        $scope.railConf = angular.copy($scope.defaultRailConf)
        socket.emit('saveSettings',{"file":"railconf","data":$scope.defaultRailConf});
        $scope.lapseConf = angular.copy($scope.defaultLapseConf);
        socket.emit('saveSettings',{"file":"lapseconf","data":$scope.defaultLapseConf});
    };
    //set current position as new "0"
    $scope.resetCurrentPosition = function() {
        $scope.railStatus.currentPosition = 0;
        socket.emit('resetPosition', $scope.railStatus);
        $scope.showSimpleToast("Position set to 0");
    };
    //save settings
    $scope.saveSettings = function(file, data) {
        socket.emit('saveSettings',{"file":file,"data":data});
    };
    //active timelapse feedback info
    socket.on('errorOnSave', function (data) {
        $scope.showSimpleToast('Something went wrong while saving settings, better hit "Reset settings" button to ensure nothing is screwed :)');
    });
    //confirmation messages
    $scope.showSimpleToast = function(message) {
        $mdToast.show(
            $mdToast.simple()
                .textContent(message)
                .position("top")
                .hideDelay(4000)
        );
    };
    //shut off
    $scope.shutOffPi = function() {
        $scope.main.toggle()
        $scope.poweredOff = true;
        socket.emit('shutOffPi',"shut it!");
    };
    //save settings
    $scope.testShot = function() {
        socket.emit('testShot',{"lapseConf":$scope.lapseConf,"railConf":$scope.railConf, "railStatus":$scope.railStatus});
    };
});