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
    var ALPHA = 0.5; //the higher this is, the more important new q's are
    var GAMMA = 1; //" " future rewards are
    var INIT_EPS = 0.5; //chance of choosing a random action initially
    var EPS_DECAY = 0.997; //how quickly epsilon decays
    var DO_Q_EST = true; //perform q value estimation

    /***********
     * objects */
    function SemiSortedArray(points) {
        var self = this;
        points = points || [];

        //the points in this data structure
        this.points = points.map(function(point) {
            return point.slice(0);
        }).sort(arrayCmp);

        this.getAllWithinROf = function(point, rs) {
            var leftBound = this.getIdxFirstGreaterThan(point[0]-rs[0]);
            var rightBound = this.getIdxFirstLessThan(point[0]+rs[0]);
            if (leftBound === -1 || rightBound === -1) return [];

            //now find the points!!
            var ret = [];
            for (var xi = leftBound; xi <= rightBound; xi++) {
                ret.push(this.points[xi]);
            }
            return ret.filter(function(p1) {
                return withinROf(point, p1[0], rs);
            });
        };
        this.upsert = function(point, val) {
            var idxs = this.getIdxInArr(point);
            if (idxs[0] === false) {
                this.points.splice(idxs[1], 0, [point, val]); //insert
            } else {
                this.points[idxs[0]][1] = val; //update
            }
        };
        this.access = function(point) {
            var idxs = this.getIdxInArr(point);
            if (idxs[0] === false) {
                return false;
            } else {
                return this.points[idxs[0]][1];
            }
        };
        this.getIdxInArr = function(point) { //by all coords
            var minIdx = 0; //inclusive
            var maxIdx = this.points.length; //exclusive
            var idxInArr = false;
            while (
                minIdx !== maxIdx &&
                minIdx < this.points.length //not gonna happen in here
            ) {
                var idx = Math.floor((minIdx+maxIdx)/2);
                var cmp = arrayCmp(this.points[idx][0], point);
                if (cmp === 0) {
                    idxInArr = idx;
                    break;
                } else if (cmp < 0) {
                    minIdx = idx+1;
                } else {
                    maxIdx = idx;
                }
            }

            return [idxInArr, minIdx, maxIdx];
        };
        this.getRoughIdxInArr = function(val) { //by first coord
            var minIdx = 0; //inclusive
            var maxIdx = this.points.length; //exclusive
            var idxInArr = false;
            while (
                minIdx !== maxIdx &&
                minIdx < this.points.length //not gonna happen in here
            ) {
                var idx = Math.floor((minIdx+maxIdx)/2);
                var cmp = this.points[idx][0][0] - val;
                if (cmp === 0) {
                    idxInArr = idx;
                    break;
                } else if (cmp < 0) {
                    minIdx = idx+1;
                } else {
                    maxIdx = idx;
                }
            }

            return [idxInArr, minIdx, maxIdx];
        };
        this.getIdxFirstLessThan = function(val) {
            if (this.points.length === 0) return -1;

            //val is the first element or it's beyond the last
            if (this.points[0][0][0] === val) return -1;
            else if (val > this.points[this.points.length-1][0][0]) {
                return this.points.length-1;
            }

            //first, use binary search to find the element
            var idxs = this.getRoughIdxInArr(val);

            //if the element wasn't actually found
            if (idxs[0] === false) {
                //then it stopped because minIdx === maxIdx
                if (this.points[idxs[1]][0][0] > val) {
                    return idxs[1] - 1;
                } else return idxs[1];
            } else {
                //it was found, gotta do more steps!
                var newMax = idxs[0];
                while (this.points[idxs[1]][0][0] < val) {
                    var idx2 = Math.floor((idxs[1]+newMax)/2);
                    var cmp = this.points[idx2][0][0] - val;
                    if (cmp === 0) {
                        newMax = idx2;
                    } else if (cmp < 0) {
                        idxs[1] = idx2+1;
                    } else {
                        newMax = idx2;
                    }
                }
                return idxs[1]-1;
            }
        };
        this.getIdxFirstGreaterThan = function(val) {
            if (this.points.length === 0) return -1;

            //val is >= the last element or it's before the first
            if (val >= this.points[this.points.length-1][0][0]) {
                return -1;
            } else if (val < this.points[0][0][0]) {
                return 0;
            }

            //first, use binary search to find the element
            var idxs = this.getRoughIdxInArr(val);

            //if the element wasn't actually found
            if (idxs[0] === false) {
                //then it stopped because minIdx === maxIdx
                if (this.points[idxs[1]][0][0] > val) {
                    return idxs[1];
                } else return idxs[1]+1;
            } else {
                //it was found, gotta do more steps!
                var newMin = idxs[0];
                while (newMin !== idxs[2]) {
                    var idx2 = Math.floor((newMin+idxs[2])/2);
                    var cmp = this.points[idx2][0][0] - val;
                    if (cmp === 0) {
                        newMin = idx2+1;
                    } else if (cmp > 0) {
                        idxs[2] = idx2;
                    } else {
                        newMin = idx2+1;
                    }
                }
                return idxs[2];
            }
        };

        function withinROf(p1, p2, rs) {
            //ai === 0 should have already been checked
            for (var ai = 1; ai < p1.length; ai++) {
                if (Math.abs(p1[ai] - p2[ai]) >= rs[ai]) return false;
            }
            return true;
        }

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
    }

    /******************
     * work functions */
    return function(initState, actions, transition, reward, every) {
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

        //private variables
        var qContainer = new SemiSortedArray();

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
        this.q = function(state, action, val) { //makes the syntax easier
            if (arguments.length === 3) {
                //upsert this q value
                var vals = qContainer.access(state);
                if (vals === false) { //not there whatsoever
                    vals = this.actions.map(function() {
                        return false; //one per action
                    });
                }
                vals[action] = val;
                qContainer.upsert(state, vals);
            } else {
                //return this q value
                var vals = qContainer.access(state);
                if (vals !== false && vals[action] !== false) {
                    return vals[action];
                } else if (!DO_Q_EST) {
                    return 0; //return a default q value
                } else {
                    //perform q value estimation here
                    var neighbors = qContainer.getAllWithinROf(
                        state,
                        [0.15, 0.15]
                    );
                    var avgQVal = 0;
                    if (this.actions.length >= 6) {
                        //adjacent actions are a proxy to action similarity
                        var numSamples = 0;
                        var qSum = 0;
                        for (var ai = -1; ai < 1; ai++) {
                            var action_ = this.actions.length+ai+action;
                            action_ = action_%this.actions.length;
                            var relNeighbors = neighbors.filter(
                                function(pair, idx) {
                                    return pair[1][action_] !==false && idx<10;
                                }
                            );
                            numSamples += relNeighbors.length;
                            qSum += relNeighbors.reduce(function(acc, pair) {
                                return acc+pair[1][action];
                            }, 0);
                        }
                        avgQVal = qSum/Math.max(numSamples, 1);
                    } else {
                        var relNeighbors = neighbors.filter(
                            function(pair, idx) {
                                return pair[1][action] !== false && idx < 10;
                            }
                        );
                        avgQVal = relNeighbors.reduce(function(acc, pair) {
                            return acc+(1/relNeighbors.length)*pair[1][action];
                        }, 0);
                    }
                    return avgQVal; //...or return a default value
                }
            }
        };
        this.getQVals = function() {
            //this will only ever be called for debugging purposes
            return JSON.parse(JSON.stringify(qContainer.points)); //deep copy
        };
    }
})();
