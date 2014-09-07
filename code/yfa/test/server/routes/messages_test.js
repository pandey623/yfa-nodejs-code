/*global describe,beforeEach,afterEach,it,before,after */
'use strict';

var messages = require('../../../src/routes/messages'),
    middleware = require('../../../src/middleware'),
    connection = require('../../db_common'),
    User = require('../../../src/models/user'),
    Image = require('../../../src/models/image'),
    Message = require('../../../src/models/message'),
    assert = require('assert'),
    HttpStatus = require('http-status'),
    async = require('async');

require('should');

describe('messages route', function () {
    var req, res, db, userCache;

    function testUser(username, first, last, email, state, done) {
        var user = new User({
            username: username,
            firstName: first,
            lastName: last,
            email: email,
            state: state,
            registrationDone: false
        });
        user.save(function (err, doc) {
            return done(err, doc);
        });
    }

    before(function () {
        db = connection();
    });

    after(function (done) {
        db.close(done);
    });

    beforeEach(function (done) {
        req = {
            user: { },
            url: '/api/v1/messages',
            baseUri: function () {
                return "https://www.example.com";
            },
            absoluteUri: function () {
                return req.baseUri() + req.url;
            },
            query: {},
            params: {}
        };

        // This is a mock response object that allows us to verify content
        // in an asynchronous way (json -> verify ---> test's done function)
        var newRes = {
            onResponse: function (verify) {
                newRes.verify = verify;
            },
            actual: null,
            headers: [],
            statusCode: 0,
            json: function (num, obj) {
                newRes.statusCode = num;
                newRes.actual = obj;

                if ("function" === typeof newRes.verify) {
                    newRes.verify();
                }
            },
            "set": function (headers) {
                (headers || {}).should.eql({
                    'Content-Type'    : 'application/problem+json',
                    'Content-Language': 'en'
                });
            }
        };
        res = newRes;

        middleware.responseProblem(req, res, function () {
        });

        var tasks = [];
        for (var i = 0; i < 2; i++) {
            tasks.push(async.apply(testUser, '' + i, 'Jim' + i, 'Schubert' + i, i + '@email.com', 'offline'));
        }
        async.parallel(tasks, function (err, results) {
            userCache = results;
            done();
        });
    });

    afterEach(function (done) {
        userCache = [];
        User.remove({}, function () {
            Image.remove({}, function(){
                Message.remove({}, function(){
                    done();
                });
            });
        });
    });

    describe('#send', function(){

        it('should fail if to and from users are the same', function(done){
            req.user._id = userCache[0]._id; // from
            req.query.user_id = userCache[0]._id; // to

            res.onResponse(function(){
                assert.equal(res.statusCode, HttpStatus.BAD_REQUEST);
                assert.equal(res.actual.title, "Can't send yourself a message");

                done();
            });

            messages.send(req, res);
        });

        it('should return a bad request for missing body', function(done){
            req.user._id = userCache[0]._id; // from
            req.query.user_id = userCache[1]._id; // to

            res.onResponse(function(){
                assert.equal(res.statusCode, HttpStatus.BAD_REQUEST);
                assert.equal(res.actual.title, "Expected request body");
                done();
            });
            messages.send(req, res);
        });

        it('should save a message as a standalone document and reference it for the "to" user', function(done){
            req.user._id = userCache[0]._id; // from
            req.query.user_id = userCache[1]._id; // to
            req.body = {
                "message": "Hello, there!"
            };

            res.onResponse(function(){
                assert.equal(res.statusCode, HttpStatus.OK);
                assert.ok("object" === typeof res.actual);

                assert.equal(res.actual.message, req.body.message);
                assert.ok(res.actual.to.equals(userCache[1]._id));
                assert.ok(res.actual.from.equals(userCache[0]._id));

                async.waterfall([
                    function validateFromUser(){
                        User.findOne({ _id: userCache[0]._id }, null, null, done);
                    },

                    function fromUserNoMessageReference(results, done){
                        assert.ok("object" === typeof results);

                        assert.ok(Array.isArray(results.messages));

                        assert.equal(results.messages.length, 0);

                        done();
                    },

                    function validateToUser(){
                        User.findOne({ _id: userCache[1]._id }, null, null, done);
                    },

                    function toUserHasMessageReference(results, done){
                        assert.ok("object" === typeof results);

                        assert.ok(Array.isArray(results.messages));

                        assert.equal(results.messages.length, 1);

                        assert.ok(results.messages[0]._id.equals(id));

                        done(null, results.messages[0]._id);
                    },

                    function validateMessage(id, done){
                        Message.findOne({ _id: id }, null, null, done);
                    },

                    function messageSaved(results, done){
                        assert.ok("object" === typeof results);

                        assert.ok(results._id.equals(id));

                        done();
                    },

                ], function(err){
                    assert.ifError(err);
                    done();
                });
            });
            messages.send(req, res);
        });
    });
});