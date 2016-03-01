"use strict";

angular.module("ngapp").config(["$stateProvider", "$urlRouterProvider", function($stateProvider, $urlRouterProvider){

    $urlRouterProvider.otherwise("/main");

    $stateProvider.state("main", {
        url: "/main",
        templateUrl: "public/app/components/main/main.html",
        title: "TimePiRail",
        controller: "MainController",
        controllerAs: "main"
    });
}]);
