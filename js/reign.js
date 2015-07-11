/******************\
|      Reign       |
| @author Anthony  |
| @version 0.1     |
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
        this.actUntilExit = function() {
            if (this.state[0] !== false) {
                var action = this.actions[
                    Math.floor(this.actions.length*Math.random())
                ];
                this.takeAction(action);

                setTimeout(this.actUntilExit.bind(this), MS_PER_ACTION);
            }
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
            //call the every function
            this.every(this.state, a, reward);

            return reward;
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
