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
    var ALPHA = 0.1; //the higher this is, the more important new q's are
    var GAMMA = 1; //" " future rewards are
    var INIT_EPS = 0.5; //chance of choosing a random action initially
    var EPS_DECAY = 0.997; //how quickly epsilon decays

    /******************
     * work functions */
    return function(initState, actions, transition, reward, every) {
        //constants
        this.initState = initState.slice(0); //state to restart in after exit
        this.actions = actions.slice(0); //the actions available
        this.transition = transition; //the action probabilities
        this.reward = reward; //the values of each state
        this.every = every || function() {}; //run after each action

        //working variables
        this.state = this.initState.slice(0);
        this.t = 0;
        this.eps = INIT_EPS;

        //private variables
        var qVals = {}; //never actually accessed directly

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
            var action = this.chooseAction(this.state)[0];
            return this.takeAction(action); //the reward
        };
        this.takeAction = function(a) {
            //save the current state
            var prevState = this.state.slice(0);
            //see where you could end up
            var possibleEndStates = this.transition(this.state, a);
            //simulate stochasticity and choose one of thoes possibilities
            this.state = this.chooseRandomly(possibleEndStates);
            //get the reward for this transition
            var reward = this.reward(this.state, prevState, a);
            //update the state-action pair's q value
            var qOld = this.q(prevState, a);
            var nextQMax = this.chooseAction(this.state)[1];
            var qNew = (1-ALPHA)*qOld + ALPHA*(reward + GAMMA*nextQMax);
            this.q(prevState, a, qNew);
            //update epsilon
            this.eps *= EPS_DECAY;
            //increment the time
            this.t += 1;
            //call the every function
            this.every(this.state, a, reward, this.q);

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
                    //array of this state's action-q-value pairs
                    return [action, self.q(state, action)];
                });
                var bestPair = actionQVals.reduce(function(ret, option) {
                    //return the pair with the highest q-value
                    if (ret === false || option[1] > ret[1]) {
                        return option; //this pair's q is better
                    } else {
                        return ret; //old one was fine
                    }
                }, false);
                var bestActions = actionQVals.filter(function(pair) {
                    return pair[1] === bestPair[1];
                });
                var randIdx = Math.floor(bestActions.length*Math.random());
                return bestActions[randIdx];
            }
        };
        this.chooseRandomly = function(set) {
            //given a set of object-weight pairs, choose a random object
            //according to its corresponding weight (which is its probabilty if
            //the weights are normalized)
            var sum = set.reduce(function(a, b) {
                return a + b[1];
            }, 0);
            var idxs = [];
            for (var ai = 0; ai < set.length; ai++) {
                var val = ai > 0 ? idxs[ai-1][1] : 0;
                val += set[ai][1]/sum;
                idxs.push([ai, val]);
            }
            var chooser = Math.random();
            for (var ai = 0; ai < idxs.length; ai++) {
                if (chooser < idxs[ai][1]) {
                    return set[idxs[ai][0]][0]; //the first one it's less than
                }
            }
            return set[0][0]; //unexpected error; return first one
        };
        this.q = function(state, action, val) { //makes the syntax easier
            if (arguments.length === 3) {
                //upsert this q value
                var idxToInsertIn = getIdxInQArr(qVals, state, action);
                if (idxToInsertIn >= 0) { //it's in the array
                    qVals[action][idxToInsertIn][1] = val;
                } else { //it's not, so insert it there
                    var adjIdx = -(idxToInsertIn+1);
                    if (!qVals.hasOwnProperty(action)) {
                        qVals[action] = [];
                    }
                    qVals[action].splice(adjIdx, 0, [state, val]);
                }
            } else {
                //return this q value
                var idx = getIdxInQArr(qVals, state, action);
                if (idx >= 0) {
                    return qVals[action][idx][1];
                } else {
                    return 0; //the default q value is 0
                }
            }
        };
        this.getQVals = function() { return qVals; };

        //helpers
        //arrayCmp returns -> 0: equal, 1: arr1 > arr2, -1: arr1 < arr2
        function arrayCmp(arr1, arr2) {
            //diff length, shorter is worth more
            if (arr1.length !== arr2.length) {
                return arr1.length < arr2.length ? 1 : -1;
            }

            //same length, go element by element
            for (var ai = 0; ai < arr1.length; ai++) {
                //earlier elements are worth more
                if (arr1[ai] !== arr2[ai]) {
                    return arr1[ai] > arr2[ai] ? 1 : -1;
                }
            }

            return 0; //they're the same
        }

        //binary searches the q values
        function getIdxInQArr(qObj, s, a) {
            if (qObj.hasOwnProperty(a)) {
                //get a list of states
                var potQs = qObj[a]; //sorted array of [state,qval]
                var states = potQs.map(function(potQ) {
                    return potQ[0]; //the state, not the q val
                });

                //binary search
                var minIdx = 0; //inclusive
                var maxIdx = states.length; //exclusive
                while (minIdx !== maxIdx && minIdx < states.length) {
                    var idx = Math.floor((minIdx+maxIdx)/2);
                    var cmp = arrayCmp(s, states[idx]);
                    if (cmp === 0) {
                        return idx;
                    } else if (cmp < 0) {
                        minIdx = idx+1;
                    } else {
                        maxIdx = idx;
                    }
                }
                return -(minIdx+1); //not in the array
            } else {
                return -(0+1); //not in the array
            }
        }
    }
})();
