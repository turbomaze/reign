/******************\
|      Reign       |
| @author Anthony  |
| @version 0.2     |
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
    var ALPHA = 0.5; //the higher this is, the more important past q's are
    var GAMMA = 1; //" " past rewards are

    /******************
     * work functions */
    return function(world, reward, actions, transition, initState, every) {
        //constants
        this.world = world.slice(0); //the geography of the world
        this.reward = reward; //the values of each state
        this.actions = actions.slice(0); //the actions available
        this.transition = transition; //the action probabilities
        this.initState = initState.slice(0); //state to restart in after exit
        this.every = every || function() {}; //run after each action

        //working variables
        this.state = this.initState.slice(0);

        //private variables
        var qVals = {}; //never actually accessed directly

        //call this for the first time
        this.every(this.state);

        //methods
        this.exitNTimes = function(n, each, end, idx, totalRwd) {
            if (n === 0) {
                end(totalRwd/(idx+1)); //the average cumulative reward
            } else {
                var self = this;
                each = each || function() {};
                end = end || function() {};
                idx = idx || 0;
                totalRwd = totalRwd || 0;

                this.actUntilExit(function(cumRwd) {
                    each.apply(
                        null,
                        [idx].concat(Array.prototype.slice.call(arguments, 0))
                    );
                    self.exitNTimes(n-1, each, end, idx+1, totalRwd+cumRwd);
                });
            }
        };
        this.actUntilExit = function(cumRwd, callback) {
            if (arguments.length < 2) { //this is the initial call
                //prep the callback
                var callbackFunc = function() {};
                if (typeof cumRwd === 'function') callbackFunc = cumRwd;

                //prep the state and act
                this.state = this.initState.slice(0);
                var rwd = this.act();
                setTimeout(
                    this.actUntilExit.bind(this, rwd, callbackFunc),
                    MS_PER_ACTION
                );
            } else { //not the initial call
                if (this.state[0] === false) { //ended yay
                    callback(cumRwd);
                } else { //intermediary call; act
                    var rwd = this.act();
                    setTimeout(
                        this.actUntilExit.bind(this, cumRwd+rwd, callback),
                        MS_PER_ACTION
                    );
                }
            }
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
            //call the every function
            this.every(this.state, a, reward);

            return reward;
        };
        this.chooseAction = function(state) {
            //choose the action the maximizes the q value
            var self = this;
            var bestAction = this.actions.map(function(action) {
                return self.q(state, action); //array of q values
            }).reduce(function(ret, qOption, idx) {
                if (ret === false || qOption > ret[1]) {
                    return [self.actions[idx], qOption]; //this q is better
                } else {
                    return ret; //old one was fine
                }
            }, false);
            return bestAction;
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
