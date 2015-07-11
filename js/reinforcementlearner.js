/******************\
|   Reinforcement  |
|      Learner     |
| @author Anthony  |
| @version 0.1     |
| @date 2015/07/11 |
| @edit 2015/07/11 |
\******************/

var ReinforcementLearner = (function() {
    'use strict';

    /**********
     * config */
    var DIMS = [960, 500];

    /*************
     * constants */

    /*********************
     * working variables */
    var canvas, ctx;

    /******************
     * work functions */
    function initReinforcementLearner() {
        //canvas stuff
        canvas = $s('#canvas');
        canvas.width = DIMS[0];
        canvas.height = DIMS[1];
        ctx = canvas.getContext('2d');
        clearCanvas('red');
    }

    /***********
     * objects */

    /********************
     * helper functions */
    function clearCanvas(color) {
        ctx.fillStyle = color || 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function $s(id) { //for convenience
        if (id.charAt(0) !== '#') return false;
        return document.getElementById(id.substring(1));
    }

    return {
        init: initReinforcementLearner
    };
})();

window.addEventListener('load', ReinforcementLearner.init);
