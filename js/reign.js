/******************\
|      Reign       |
| @author Anthony  |
| @version 0.3     |
| @date 2015/07/11 |
| @edit 2015/07/11 |
\******************/

var Reign = (function() {
    'use strict';

    /**********
     * config */
    var MS_PER_ACTION = 100;

    /*************
     * constants */
    var ALPHA = 0.03; //weight learning rate
    var GAMMA = 1; //how important future q's are
    var INIT_EPS = 0.5; //chance of choosing a random action initially
    var EPS_DECAY = 0.997; //how quickly epsilon decays

    /***********
     * objects */

    /******************
     * work functions */
    return function(
        stateRanges, initState, actions, transition, reward, every
    ) {
        //constants
        this.initState = initState.slice(0); //state to restart in after exit
        this.actions = actions.slice(0); //the actions available
        this.transition = transition; //given (s,a), returns the next state
        this.reward = reward; //given (s_,s,a)
        this.every = every || function() {}; //run after each action

        //working variables
        this.state = this.initState.slice(0);
        this.t = 0;
        this.eps = INIT_EPS;
        this.sp = new Uition.SP({
            numCols: 100,
            sparsity: 0.07,
            minOverlap: 4,
            encoder: 'vector',
            encoderCfg: {
                n: 120,
                w: 0.4,
                rngs: stateRanges.concat([
                    [this.actions[0], this.actions[this.actions.length-1]]
                ])
            }
        });
        this.w = []; //feature weights
        this.hist = []; //count of column activations
        for (var wi = 0; wi < this.sp.cfg.numCols; wi++) {
            this.w.push(0);
            this.hist.push(0);
        }
        this.w.push(0); //bias

        //methods
        this.exitNTimes = function(n, msPerAction, each, end, idx, totalRwd) {
            if (n === 0) {
                end(totalRwd/idx); //the average cumulative reward
            } else {
                //take care of the argument possibilities
                switch (arguments.length) {
                    case 1:
                        msPerAction = MS_PER_ACTION;
                        each = each || function() {};
                        end = end || function() {};
                        break;
                    case 2:
                        if (typeof msPerAction === 'number') {
                            each = each || function() {};
                            end = end || function() {};
                        } else {
                            each = msPerAction;
                            msPerAction = MS_PER_ACTION;
                        }
                        break;
                    case 3:
                        if (typeof msPerAction === 'number') {
                            end = end || function() {};
                        } else {
                            end = each;
                            each = msPerAction;
                            msPerAction = MS_PER_ACTION;
                        }
                        break;
                }
                idx = idx || 0;
                totalRwd = totalRwd || 0;

                //whew! act until exit and async recurse
                var self = this;
                this.actUntilExit(msPerAction, function(cumRwd) {
                    each.apply(
                        null,
                        [idx].concat(Array.prototype.slice.call(arguments, 0))
                    );
                    self.exitNTimes(
                        n-1, msPerAction, each, end, idx+1, totalRwd+cumRwd
                    );
                });
            }
        };
        this.actUntilExit = function(msPerAction, cumRwd, callback) {
            //this is the initial call
            if (arguments.length < 3) {
                //prep the arguments urgh
                if (typeof msPerAction === 'function') {
                    callback = msPerAction;
                    msPerAction = MS_PER_ACTION;
                } else {
                    switch(arguments.length) {
                        case 1:
                            callback = function() {};
                            break;
                        case 2:
                            callback = cumRwd;
                            break;
                    }
                }
                cumRwd = 0;

                //prep the state
                this.state = this.initState.slice(0);
            } else if (this.state[0] === false) { //ended yay
                return callback(cumRwd);
            }

            //if you made it here, you're either starting or continuing
            var rwd = this.act();
            setTimeout(
                this.actUntilExit.bind(
                    this, msPerAction, cumRwd+rwd, callback
                ),
                msPerAction
            );
        };
        this.act = function() {
            if (this.state[0] === false) this.state = this.initState.slice(0);

            var action = this.chooseAction(this.state)[0];
            return this.takeAction(action); //the reward
        };
        this.takeAction = function(a) {
            //save the current state
            var prevState = this.state.slice(0);
            //see where you end up
            this.state = this.transition(this.state, a);
            //get the reward for this transition
            var reward = this.reward(this.state, prevState, a);
            //log this activity
            var activeFeatures = this.sp.process(prevState.concat([a]), true);
            for (var fi = 0; fi < activeFeatures.length; fi++) {
                this.hist[activeFeatures[fi]] += 1;
            }
            //update the weights
            var qOld = this.q(prevState, a);
            var nextQMax = this.chooseAction(this.state)[1];
            var delta = reward + GAMMA*nextQMax - qOld;
            activeFeatures.push(this.w.length-1); //last one is bias
            for (var fi = 0; fi < activeFeatures.length; fi++) {
                this.w[activeFeatures[fi]] += ALPHA*delta;
            }
            //update epsilon
            this.eps *= EPS_DECAY;
            //increment the time
            this.t += 1;
            //call the every function
            this.every(this.state, a, reward, this.q.bind(this));

            return reward;
        };
        this.chooseAction = function(state) {
            //choose the action the maximizes the q value
            var self = this;
            if (Math.random() < this.eps) {
                var randIdx = Math.floor(this.actions.length*Math.random());
                var randAction = this.actions[randIdx];
                return [randAction, this.q(state, randAction)];
            } else {
                var actionQVals = this.actions.map(function(action) {
                    //max exploration boost
                    var k = 100;
                    //get this pair's features
                    var activeFeatures = self.sp.process(
                        state.concat([action])
                    );
                    //calculate how often it has been visited for boosting
                    var activity = 1;
                    for (var fi = 0; fi < activeFeatures.length; fi++) {
                        activity += self.hist[activeFeatures[fi]];
                    }
                    activity /= activeFeatures.length;
                    var qBoost = k/Math.pow(activity, 0.5);
                    //compute the unchanged q value
                    activeFeatures.push(self.w.length-1); //last one is bias
                    var rawQ = 0;
                    for (var fi = 0; fi < activeFeatures.length; fi++) {
                        rawQ += self.w[activeFeatures[fi]];
                    }
                    //return the pair with the boosted value
                    return [action, rawQ, rawQ+qBoost];
                });
                var bestPair = actionQVals.reduce(function(ret, option, idx) {
                    //return the pair with the highest q-value
                    if (ret === false || option[2] > ret[2]) {
                        return option; //this pair's q is better
                    } else {
                        return ret; //old one was fine
                    }
                }, false);
                var bestActions = actionQVals.filter(function(pair) {
                    return pair[2] === bestPair[2];
                });
                var randIdx = Math.floor(bestActions.length*Math.random());
                return bestActions[randIdx];
            }
        };
        this.q = function(state, action) { //makes the syntax easier
            var activeFeatures = this.sp.process(state.concat([action]));
            activeFeatures.push(this.w.length-1); //last one is bias
            var total = 0;
            for (var fi = 0; fi < activeFeatures.length; fi++) {
                total += this.w[activeFeatures[fi]];
            }
            return total;
        };
    }
})();
