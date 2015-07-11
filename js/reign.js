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

        //call this for the first time
        this.every(this.state);

        //methods
        this.actUntilExit = function() {
            if (this.state[0] !== false) {
                var action = this.actions[
                    Math.floor(this.actions.length*Math.random())
                ];
                this.takeAction(action);

                setTimeout(this.actUntilExit.bind(this), 500);
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
    }
})();
