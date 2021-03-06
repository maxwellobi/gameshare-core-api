'use strict';
let debug = require('debug')('gameshare-core-api:register');
let router = require('express').Router();
let bcrypt = require('bcrypt');
let User = require('../models/user');
let session = require('../helpers/session');
let _ = require('lodash');

/* POST: register user */ 
exports.register_user_post = (req, res, next) => {

    debug("Payload => " + JSON.stringify(req.body));

    //run validation checks
    req.checkBody('email', 'Please provide a valid email').isEmail();
    req.checkBody('firstname', 'Your first name is required').isAlpha().notEmpty();
    req.checkBody('lastname', 'Your last name is required').isAlpha().notEmpty();
    req.checkBody('phonenumber', 'Phone number is not valid').notEmpty().isMobilePhone('en-NG');
    req.checkBody('password', 'Password must have at least 6 characters').notEmpty().isLength({ min: 6 });

    //sanitize the input
    req.sanitizeBody('email').escape();
    req.sanitizeBody('firstname').escape();
    req.sanitizeBody('lastname').escape();
    req.sanitizeBody('phonenumber').escape();
    req.sanitizeBody('password').escape();

    req.getValidationResult().then((validation_result) => {

        if(!validation_result.isEmpty()){ //there is error

            let error = new Error(validation_result.array({ onlyFirstError: true })[0].msg);
            error.status = 400; //bad request

            debug("Encountered validation error: " + error.message);
            return next(error);
        }

        //save the user
        let hashedPassword = bcrypt.hashSync(req.body.password, 3);
        let user = new User({
            email: req.body.email,
            firstname: req.body.firstname,
            lastname: req.body.lastname,
            phonenumber: req.body.phonenumber,
            password: hashedPassword
        });

        
        user.save((err, user) => {
            if(err && err.code === 11000) {

                let util = require('../helpers/utilities');
                err.message = util.get_duplicate_message(err);

                debug('New user could not be created: ' + err.message);
                return next(err);

            }else if(err) return next(err);

            // create a token
            let token_data = _.pick(user, ['_id', 'email', 'firstname', 'lastname']);
            let token = session.generateToken(token_data); //generate JWT token and save to redis store

            debug('New user created successfully: token =' + token);
            token_data.phonenumber = user.phonenumber;
            res.json({
                authenticated: true,
                token: token,
                user: token_data
            });
            
        });

    });
};