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
    var defaultVariables = {
        "dedicatedShutter":true,
        "bulbMode":false,
        "shutterSpeed":300,
        "focusLength":0,
        "focusEnabled":true,
        "motorPulse":1000,
        "interval":1500,
        "direction":false, //backward
        "railLength":10000,
        "shotsLeft":0
    };
    $scope.railStatus = {}
    $scope.timelapseVariables = {};
    //check if not too close
    $scope.endOfRails = function() {
        return $scope.timelapseVariables.direction && $scope.railStatus.currentPosition >= $scope.timelapseVariables.railLength - $scope.timelapseVariables.motorPulse || !$scope.timelapseVariables.direction && $scope.railStatus.currentPosition <= $scope.timelapseVariables.motorPulse
    };
    $scope.loadBar = function() {
        var calculate = ($scope.timelapseVariables.shotsLeft-$scope.railStatus.count)/($scope.timelapseVariables.shotsLeft/100)
        if ($scope.timelapseVariables.direction) {
            return parseInt(100 - calculate)
        } else {
            return parseInt(calculate)
        }
    };
    //how many shots left
    $scope.shotsLeft =  function() {
        console.log($scope.railStatus)
       if ($scope.timelapseVariables.direction) {
           return  parseInt(($scope.timelapseVariables.railLength-$scope.railStatus.currentPosition)/$scope.timelapseVariables.motorPulse)
       } else {
           return  parseInt($scope.railStatus.currentPosition/$scope.timelapseVariables.motorPulse)
       }
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
            if (data.timelapseVariables) {
                console.log("saved")
                $scope.timelapseVariables = JSON.parse(data.timelapseVariables);
                //use default
            } else {
                console.log("defa")
                $scope.timelapseVariables = defaultVariables
            }
        });

    });


    //active timelapse feedback info
    socket.on('timelapseStatus', function (data) {
        $scope.$apply(function() {
            $scope.railStatus = data
        });
    });

    //run the timelapse
    $scope.runTimelapse = function() {
        $scope.timelapseVariables.shotsLeft = angular.copy($scope.shotsLeft());
        socket.emit('runTimelapse', $scope.timelapseVariables);
    };

    //cancel timelapse
    $scope.cancelTimelapse = function(source) {
        socket.emit('cancelTimelapse',{source:source});
    };



    //cancel timelapse
    $scope.restoreDefaultSettings = function() {
        $scope.timelapseVariables = angular.copy(defaultVariables);
        socket.emit('saveSettings',defaultVariables);
    };

    $scope.stopWatch = 0;
    $scope.resetStopWatch = function() {
        $scope.stopWatch = 0;
    }

    var timer = null;
    $scope.stopWatch = 0;
    $scope.manualDirection = false;

    var stopStopWatch = function() {
        $timeout.cancel(timer);
        timer = null;
    };

    var updateStopWatch = function(direction) {
            if( $scope.manualDirection==="forward") {
                $scope.stopWatch += 10;
            } else {
                $scope.stopWatch -= 10;
            }

        timer = $timeout(updateStopWatch, 10);
    };
    $scope.manualSlide = function(direction, state) {
        console.log(direction, state)
        if(!state) {
            if (timer === null) {
                $scope.manualDirection = direction;
                updateStopWatch(direction);
            }
        } else {
            $scope.manualDirection = false;
            stopStopWatch();
        }
        socket.emit('manualSlide',{direction:direction, state:!state});
    };

})