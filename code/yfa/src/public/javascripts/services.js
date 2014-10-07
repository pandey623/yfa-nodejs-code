(function(angular){
    'use strict';

    /* Services */
    angular.module('myApp.services', []).
        value('version', '0.1');

    angular.module('myApp.services')
        .service('Api', [
                    '$http',
            function($http){
                var apiBase = '/api/v1';
                return {
                    users: {
                        getById: function (id){
                            return $http({
                                url: apiBase + '/users/' + id,
                                method: 'GET',
                                cache: false
                            });
                        },
                        list: function (options){
                            return $http({
                                url: apiBase + '/users',
                                params: options,
                                method: 'GET',
                                cache: false
                            });
                        }
                    },
                    cohorts: {
                        remove: function(cohortId, userId){
                            var options = {
                                user_id: userId
                            };
                            return $http({
                                url: apiBase + '/cohorts/'+cohortId,
                                params: options,
                                method: 'DELETE',
                                cache: false
                            });
                        },

                        add: function(cohortId, userId){
                            var options = {
                                user_id: userId
                            };
                            return $http({
                                url: apiBase + '/cohorts/'+cohortId,
                                params: options,
                                method: 'POST',
                                cache: false
                            });
                        }
                    },
                    images: {
                        getById: function(id){
                            return $http({
                                url: apiBase + '/images/' + id,
                                method: 'GET',
                                cache: false
                            });
                        }
                    },
                    messages: {
                        getById: function(id){
                            return $http({
                                url: apiBase + '/messages/' + id,
                                method: 'GET',
                                cache: false
                            });
                        },
                        deleteById: function(id){
                            return $http({
                                url: apiBase + '/messages/' + id,
                                method: 'DELETE',
                                cache: false
                            });
                        }
                    }
                };
            }
        ]);

    angular.module('myApp.services')
        .service('MessageService', [
                    '$rootScope','ConversationFactory','Api',
            function($rootScope , ConversationFactory , Api){
                var service = {}, conversations = [];

                service.addMessage = function(id){
                    Api.messages.getById(id)
                        .success(function(message){
                            var i = 0,len = conversations.length,found = false;
                            for(i;i<len;i++){
                                var current = conversations[i];
                                if(current.shouldContainMessage(message) &&
                                    current.addMessage(message)){
                                    found = true;
                                    $rootScope.$broadcast('messageAdded', {
                                        id: id
                                    });
                                }
                            }

                            // If no existing conversations or
                            // no conversation open with the target user...
                            if(!found){
                                conversations.push(ConversationFactory(message));
                                $rootScope.$broadcast('messageAdded', {
                                    id: id
                                });
                            }
                        });
                };

                service.removeMessage = function(id){
                    var index = conversations.indexOf(id);
                    if(index > -1){
                        conversations.splice(index, 1);
                        $rootScope.$broadcast('messageRemoved', { id: id });
                    }
                };

                service.list = function(){
                    return angular.copy(conversations);
                };

                return service;
            }
        ]);

    angular.module('myApp.services')
        .factory('ConversationFactory', [
                    'USER_CONTEXT',
            function(USER_CONTEXT){
                var maxConversationLength = 75;
                function Conversation(message){
                    var target;
                    if(message.to === USER_CONTEXT.id){
                        target = message.from;
                    } else {
                        target = message.to;
                    }

                    this.messages = angular.isDefined(message) ?
                        [message] :
                        [];

                    Object.defineProperty(this, 'target', {
                        enumerable: false,
                        configurable: false,
                        writable: false,
                        value: target
                    });

                    this.toString = function(){
                        return target + ' (' + this.messages.length + ')';
                    }
                }

                Conversation.prototype = {
                    hasMessage: function(id){
                        var i, len = this.messages.length;
                        for(i = 0; i < len; i++){
                            if(this.messages[i]._id === id){
                                return true;
                            }
                        }
                        return false;
                    },
                    addMessage: function(message){
                        this.messages.push(message);
                        if(this.messages.length > maxConversationLength){
                            this.messages = this.messages.slice(0,maxConversationLength);
                        }
                        return true;
                    },
                    removeMessage: function(message){
                        return this.removeMessageById(message._id);
                    },
                    removeMessageById: function(id){
                        var index = this.messages.indexOf(id);
                        if(index > -1){
                            this.messages.splice(index, 1);
                            return true;
                        }
                        return false;
                    },
                    shouldContainMessage: function(message){
                        return this.target === message.to || this.target === message.from;
                    }
                };

                return function(message){
                    return new Conversation(message);
                };
            }
        ]);
})(angular);
