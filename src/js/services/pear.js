'use strict';

/**
 * @ngdoc function
 * @name Pear2Pear.service:Pear
 * @description
 * # Pear service
 * Provides controllers with a data model for pear to pear app
 * It serves as an abstraction between Pear data and backend (SwellRT)
 */

angular.module('Pear2Pear')
  .factory('pear', [
           '$rootScope', 'swellRT', '$q', '$timeout', 'base64',
           function($rootScope, swellRT, $q, $timeout, base64) {

    var proxy = {
      communities: {}
    };

    // FIXME model prototype
    var urlId = function(id) {
      if (id === undefined) { return ''; }

      return base64.encode(id);
    };

    // map of opened projects
    var openedProjects = {};

    var def = $q.defer();

    var communities = {

      all: function() {
        return proxy.communities;
      },

      find: function(urlId) {
        var id = base64.decode(urlId);
        var community = proxy.communities[id];

        return {
          community: community,
          projects: {
            all: function() {
              var promises = {};
              angular.forEach(community.projects, function(val){
                var projDef = $q.defer();
                promises[val] = projDef.promise;
                if (!openedProjects[val]){
                  window.SwellRT.openModel(val, function(model){
                    $timeout(function(){
                      var pr = swellRT.proxy(model);
                      openedProjects[val] = pr;
                      projDef.resolve(pr);
                    });
                  });
                } else {
                  projDef.resolve(openedProjects[val]);
                }
              });

              var projsDef = $q.all(promises);
              return projsDef;
            },
            destroy: function(projId){
              var i = community.projects.indexOf(projId);
              if (i > -1){
                community.projects.splice(i,1);
              }
            }
          }
        };
      },
      create: function(data, callback) {
        var id = window.SwellRT.createModel(function(model){
          var p = swellRT.proxy(model);
          p.name = data.name;
          p.id = id;
          p.projects = [];
          proxy.communities[id] = p;
          callback({
            community: p,
            projects: {
              // TODO avoid repeated function
              all: function() {
                var promises = {};
                angular.forEach(community.projects, function(val){
                  var projDef = $q.defer();
                  promises[val] = projDef.promise;
                  if (!openedProjects[val]){
                    window.SwellRT.openModel(val, function(model){
                      $timeout(function(){
                        var pr = swellRT.proxy(model);
                        openedProjects[val] = pr;
                        projDef.resolve(pr);
                      });
                    });
                  } else {
                    projDef.resolve(openedProjects[val]);
                  }
                });

                var projsDef = $q.all(promises);
                return projsDef;
              }
            }});
        });
      },
      destroy: function(urlId) {
        var id = base64.decode(urlId);

        delete proxy.communities[id];

        return urlId;
      }
    };

    var projects = {

      find: function(urlId) {
        var id = base64.decode(urlId);

        def = $q.defer();

        if (!openedProjects[id]) {
          window.SwellRT.openModel(id, function(model){
            var pr = swellRT.proxy(model);
            openedProjects[id] = pr;
            def.resolve(openedProjects[id]);
          }, function(error){
            def.reject(error);
          });
        } else {
          def.resolve(openedProjects[id]);
        }
        return def.promise;
      },
      create: function(callback) {
        var id = window.SwellRT.createModel(function(model){
          var p = {
            proj : {}
          };
          proxy.proj = swellRT.proxy(model);
          $timeout(function(){
            proxy.proj['id'] = id;
            proxy.proj['title'] = '';
            proxy.proj['chat'] = [];
            proxy.proj['pad'] = new swellRT.TextObject();
            proxy.proj['needs'] = [];
            proxy.proj['promoter'] = users.current();
            openedProjects[id] = proxy.proj;
            callback(proxy.proj);
          });
        });
      }
    };

    var users = {
      current: function() {
        return window.sessionStorage.getItem('userId');
      },
      setCurrent: function(name) {
        return window.sessionStorage.setItem('userId', name.trim());
      },
      isCurrent: function(user) {
        return user === users.current();
      },
      loggedIn: function() {
        return users.current() !== 'undefined' && users.current() !== null;
      }
    };

    var addChatMessage = function(projectId, message) {
      projects.find(projectId).then(function(project){
        project.chat.push({
          text: message,
          who: users.current(),
          time: (new Date()).toJSON()
        });
      }, function(error){
        console.log(error);
      });
    };

    window.onSwellRTReady = function () {
      window.SwellRT.startSession(
        SwellRTConfig.server, SwellRTConfig.user, SwellRTConfig.pass,
        function() {
          // Open Community List
          window.SwellRT.openModel(
            SwellRTConfig.communityListWaveId,
            function(model) {
              proxy.communities = swellRT.proxy(model);
              if (!proxy.communities){
                proxy['communities'] = {};
              }
              def.resolve(proxy.model);
            },
            function(error){
              console.log(error);
            });
          },

        function(error) {
          console.log(error);
        });
      // to avoid multiple calls
      window.onSwellRTReady = null;
    };

    if (window.SwellRT && typeof window.onSwellRTReady === 'function') {
      window.onSwellRTReady();
    }

    return {
      communities: communities,
      projects: projects,
      users: users,
      urlId: urlId,
      addChatMessage: addChatMessage,
      onLoad: function(f) {
        def.promise.then(f);
      }
    };
  }]);
