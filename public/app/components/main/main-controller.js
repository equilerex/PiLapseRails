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
    // Available settings
    //***********************************************************
    $scope.defaultLapseConf = {
        "bulbMode":false,
        "shutterSpeed":300,
        "focusLength":0,
        "motorPulse":1000,
        "waitLength":500,
        "direction":false, //backward
        "loop":false
    };
    $scope.defaultRailConf = {
        "focusEnabled":false,
        "railLength":10000
    };
    $scope.railStatus = {
        "shotsLeft":0,
        "timeLeft":0,
        "interval":0
    };
    $scope.lapseConf = {};
    $scope.railConf = {};

    //check if not too close to end of rails
    $scope.endOfRails = function() {
        return $scope.lapseConf.direction && $scope.railStatus.currentPosition >= $scope.railConf.railLength - $scope.lapseConf.motorPulse || !$scope.lapseConf.direction && $scope.railStatus.currentPosition <= $scope.lapseConf.motorPulse
    };


    //***********************************************************
    // progress / calculation feedback
    //***********************************************************
    $scope.loadBar = function() {
        var calculate = ($scope.railStatus.shotsLeft-$scope.railStatus.count)/($scope.railStatus.shotsLeft/100)
        if ($scope.lapseConf.direction) {
            return parseInt(100 - calculate)
        } else {
            return parseInt(calculate)
        }
    };
    $scope.shotsLeft =  function() {
        if ($scope.lapseConf.direction) {
            return  parseInt(($scope.railConf.railLength-$scope.railStatus.currentPosition)/$scope.lapseConf.motorPulse)
        } else {
            return  parseInt($scope.railStatus.currentPosition/$scope.lapseConf.motorPulse)
        }
    };
    $scope.timeLeft =  function() {
        console.log($scope.railStatus.currentPosition)
        var time = 0
        if ($scope.lapseConf.direction) {
            time = moment.duration($scope.railConf.railLength-$scope.railStatus.currentPosition, "S")
        } else {
            time = moment.duration($scope.railStatus.currentPosition, "S")
        }
        return  moment(time._data).format("hh:mm:ss")
    };
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
        console.log(interval)
        interval = moment.duration(interval);
        return  moment(interval._data).format("mm:ss:SS");

    };
    $scope.updateEstimate = function(){
        $scope.railStatus.shotsLeft = $scope.shotsLeft();
        $scope.railStatus.timeLeft = $scope.timeLeft();
        $scope.railStatus.interval =  $scope.intervalNumber()
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
        $scope.railStatus.shotsLeft = angular.copy($scope.shotsLeft());
        socket.emit('runTimelapse', {"lapseConf":$scope.lapseConf,"railConf":$scope.railConf});
    };

    //cancel timelapse
    $scope.cancelTimelapse = function(source) {
        socket.emit('cancelTimelapse', {"lapseConf":$scope.lapseConf,"railConf":$scope.railConf});
    };

    //manual move
    $scope.manualSlide = function(direction, state) {
        console.log(direction, state)
        socket.emit('manualSlide',{direction:direction, state:!state});
    };
    //save settings
    $scope.saveSettings = function(file, data) {
        socket.emit('saveSettings',{"file":file,"data":data});
    }
});