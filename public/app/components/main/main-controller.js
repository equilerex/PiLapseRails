"use strict";

angular.module("ngapp").controller("MainController", function(shared, $state, $scope, $mdSidenav, $mdComponentRegistry, $timeout){
    var windowsDevEnvironment = false;
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

    //***********************************************************
    // Available settings / default values
    //***********************************************************
    $scope.defaultLapseConf = {
        "bulbMode":false,
        "shutterSpeed":300,
        "focusLength":0,
        "motorPulse":1000,
        "waitLength":500,
        "direction":false, //backward
        "loopEnabled":false,
        "loopCount":false
    };
    $scope.defaultRailConf = {
        "focusEnabled":false,
        "railLength":false
    };
    $scope.railStatus = {
        "shotsLeft":0,
        "timeLeft":0,
        "interval":0
    };
    $scope.lapseConf = {};
    $scope.railConf = {};



    //***********************************************************
    // progress / calculation feedback
    //***********************************************************
    //check if not too close to end of rails
    $scope.endOfRails = function() {
        return $scope.lapseConf.direction && $scope.railStatus.currentPosition >= $scope.railConf.railLength - $scope.lapseConf.motorPulse || !$scope.lapseConf.direction && $scope.railStatus.currentPosition <= $scope.lapseConf.motorPulse
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
    //shots calculation
    $scope.shotsLeft =  function() {
        var loopAddon = 0;
        var count = 0;
        if( $scope.railStatus.loopCount) {
            count = $scope.railStatus.loopCount
        } else {
            count = $scope.lapseConf.loopCount
        }
        if($scope.lapseConf.loopEnabled && count>0) {
            loopAddon = $scope.railConf.railLength*count;
        }
        console.log(loopAddon,  count)
        if($scope.lapseConf.direction) {
            return  parseInt((($scope.railConf.railLength-$scope.railStatus.currentPosition+loopAddon)/$scope.lapseConf.motorPulse))
        } else {
            return  parseInt(($scope.railStatus.currentPosition+loopAddon)/$scope.lapseConf.motorPulse)
        }
    };
    //remaining time calculation
    $scope.timeLeft =  function() {
        var timeLeft =  moment.duration($scope.intervalNumber()*$scope.shotsLeft())
        return  moment(timeLeft._data).format("mm:ss:SS")
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
            $scope.railStatus.shotsLeft = $scope.shotsLeft();
        }
        $scope.railStatus.timeLeft = $scope.timeLeft();
        var intervalNumber = moment.duration($scope.intervalNumber());
        $scope.railStatus.interval =  moment(intervalNumber._data).format("mm:ss:SS");
    };

    //***********************************************************
    //Communicate with Raspberry runtime
    //***********************************************************
    //connect to raspberry data feed
    var socket = "";
    if(windowsDevEnvironment){
        socket = io.connect('http://localhost:8080');
    } else {
        socket = io.connect('http://192.168.43.80:8080');
    }
    //device has been connected event
    socket.on('connect', function(data){
        socket.emit('pageLoaded');
    });
    //fetch saved data upon loading
    socket.on('connectionEstablished', function(data){
        //use saved data
        $scope.$apply(function() {
            if (data.railConf) {
                $scope.railConf = JSON.parse(data.railConf);
                //use default
            } else {
                $scope.railConf = $scope.defaultRailConf
            }
            if (data.lapseConf) {
                $scope.lapseConf = JSON.parse(data.lapseConf);
                //use default
            } else {
                $scope.lapseConf = $scope.defaultLapseConf
            }
            $timeout(function(){$scope.updateEstimate()},300)
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
    $scope.resetRailConf = function(file, data) {
        $scope.railConf = angular.copy($scope.defaultRailConf)
        socket.emit('saveSettings',{"file":"railconf","data":$scope.defaultRailConf});
    };
    //reset lapseConf
    $scope.resetLapseConf = function(file, data) {
        $scope.lapseConf = angular.copy($scope.defaultLapseConf)
        socket.emit('saveSettings',{"file":"railconf","data":$scope.defaultLapseConf});
    };
    $scope.resetCurrentPosition = function() {
        $scope.railStatus.currentPosition = 0;
        socket.emit('resetPosition', $scope.railStatus);
    };

    //save settings
    $scope.saveSettings = function(file, data) {
        socket.emit('saveSettings',{"file":file,"data":data});
    }
});