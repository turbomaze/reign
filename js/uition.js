/******************\
|   Hierarchical   |
| Temporal Memory  |
|      System      |
| @author Anthony  |
| @version 0.1     |
| @date 2015/08/12 |
| @edit 2015/08/15 |
\******************/

var Uition = (function() {
    'use strict';

    /*************
     * constants */
    var ALPHANUM = '?'+' '+'0123456789'+
                   'abcdefghijklmnopqrstuvwxyz'+
                   'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    /***********
     * objects */
    function SpatialPooler(settings) {
        settings = settings || {};

        //default configuration
        this.cfg = {
            numCols: settings.numCols || 2048,
            sparsity: settings.sparsity || 0.02,
            cellsPerCol: settings.cellsPerCol || 4,

            pctPotSyns: settings.pctPotSyns || 0.50,
            permThresh: settings.permThresh || 0.20,
            initPermSpread: settings.initPermSpread || 0.08,
            permInc: settings.permInc || 0.06,
            permDec: settings.permDec || 0.06,

            minOverlap: settings.minOverlap || 7,

            encoder: settings.encoder || 'alphanum',
            encoderCfg: settings.encoderCfg || {
                n: 100,
                w: 40
            }
        };
        this.synsPerCol = this.cfg.encoderCfg.n*this.cfg.pctPotSyns;
        this.encode = getEncoder(this.cfg.encoder, this.cfg.encoderCfg);

        this.maxActv = 0;
        this.actvs = []; //activities
        this.ovlps = []; //overlaps
        this.syns = []; //encoded input bit idx and permanence
        for (var ai = 0; ai < this.cfg.numCols; ai++) {
            this.actvs.push(0);
            this.ovlps.push(0);
            var potSynIdxs = getRandPerm(this.cfg.encoderCfg.n);
            for (var bi = 0; bi < this.synsPerCol; bi++) {
                var perm = this.cfg.permThresh - this.cfg.initPermSpread;
                perm += 2*Math.random()*this.cfg.initPermSpread;
                this.syns.push([potSynIdxs[bi], perm]);
            }
        }
    }
    SpatialPooler.prototype.process = function(rawInp, learn) {
        var enc = this.encode(rawInp);
        var overlaps = [];
        var maxActv = this.actvs.reduce(function(a, b) {
            return Math.max(a, b);
        }, 0);
        var minActv = 0.01*maxActv;

        //get the overlaps
        for (var ai = 0; ai < this.cfg.numCols; ai++) {
            overlaps.push(0);
            var synStart = this.synsPerCol*ai;
            for (var bi = synStart; bi < synStart+this.synsPerCol; bi++) {
                var syn = this.syns[bi];
                if (syn[1] > this.cfg.permThresh && enc[syn[0]]) {
                    //connected and active
                    overlaps[ai]++;
                }
            }
        }

        //boosting
        var k = 3;
        for (var ai = 0; ai < this.cfg.numCols; ai++) {
            this.ovlps[ai] *= 0.98;
            //min overlap
            if (overlaps[ai] < this.cfg.minOverlap) overlaps[ai] = 0;
            else {
                var boost = 1;
                if (this.actvs[ai] < minActv) {
                    boost = k - this.actvs[ai]*(k-1)/minActv;
                }
                overlaps[ai] *= boost;
                this.ovlps[ai] += 1;
            }
        }

        //inhibition
        var sortedOvlps = overlaps.slice(0).sort(function(a, b) {
            return b-a;
        });
        var desNumActvCols = Math.floor(this.cfg.sparsity*this.cfg.numCols);
        var minOvlpActv = sortedOvlps[desNumActvCols];
        var actvCols = [];
        for (var ai = 0; ai < this.cfg.numCols; ai++) {
            this.actvs[ai] *= 0.98;
            if (overlaps[ai] >= minOvlpActv && overlaps[ai] > 0) {
                actvCols.push(ai);
                this.actvs[ai] += 1;
            }
        }

        if (learn !== true) return actvCols;

        //learning
        for (var ai = 0; ai < actvCols.length; ai++) {
            var synStart = this.synsPerCol*actvCols[ai];
            for (var bi = synStart; bi < synStart+this.synsPerCol; bi++) {
                var syn = this.syns[bi];
                if (syn[1] > this.cfg.permThresh && enc[syn[0]]) {
                    //connected and active
                    this.syns[bi][1] += this.cfg.permInc;
                    this.syns[bi][1] = Math.min(this.syns[bi][1], 1);
                } else {
                    this.syns[bi][1] -= this.cfg.permDec;
                    this.syns[bi][1] = Math.max(this.syns[bi][1], 0);
                }
            }
        }

        for (var ai = 0; ai < this.cfg.numCols; ai++) {
            if (this.ovlps[ai] < minActv) {
                var synStart = this.synsPerCol*ai;
                for (var bi = synStart; bi < synStart+this.synsPerCol; bi++) {
                    this.syns[bi][1] += 0.1*this.cfg.permThresh;
                    this.syns[bi][1] = Math.min(this.syns[bi][1], 1);
                }
            }
        }

        return actvCols;
    };
    SpatialPooler.prototype.sense = function(rawInp) {
        var ret = [];
        var actvs = this.process(rawInp, true);
        /*console.log(actvs.length);
        console.log(this.syns.reduce(function(a, b) {
            return a + b[1];
        }, 0)/this.syns.length);*/
        for (var ai = 0; ai < this.cfg.numCols; ai++) {
            var active = actvs.indexOf(ai) !== -1;
            for (var bi = 0; bi < this.cfg.cellsPerCol; bi++) {
                ret.push(active ? 1 : 0);
            }
        }
        return ret;
    };

    function getEncoder(type, cfg) {
        cfg = cfg || {};
        var encoders = {
            scalar: function(value) {
                var bkts = 1 + (cfg.n - cfg.w);
                var bucket = Math.floor(
                    bkts*(value-cfg.min)/(cfg.max-cfg.min)
                );
                bucket = Math.min(Math.max(0, bucket), bkts-1);

                var out = [];
                for (var ai = 0; ai < bucket; ai++) out.push(false);
                for (var ai = 0; ai < cfg.w; ai++) out.push(true);
                for (var ai = 0; ai < cfg.n-(bucket+cfg.w); ai++) {
                    out.push(false);
                }

                return out;
            },
            alphanum: function(value) {
                function randCycle(num, range) {
                    var a = 71693, b = 4549;
                    return (a*num+b)%range;
                }

                var categoryIdx = ALPHANUM.indexOf(value);
                if (categoryIdx < 0) categoryIdx = 0; //unknowns are '?'

                var curr = randCycle(categoryIdx, 1000*cfg.n);
                var out = [];
                for (var ai = 0; ai < cfg.n; ai++) out.push(false);
                for (var ai = 0; ai < cfg.w; ai++) {
                    out[curr%cfg.n] = true;
                    curr = randCycle(curr, 24499);
                }

                return out; //guaranteed to have <= w "trues" guaranteed
            },
            vector: (function() {
                cfg.rngs = cfg.rngs || [];

                //get the component-wise scalar encoders
                var encs = [];
                var eachN = Math.floor(cfg.n/cfg.rngs.length);
                var lastN = cfg.n - (cfg.rngs.length-1)*eachN;
                for (var ai = 0; ai < cfg.rngs.length; ai++) {
                    var thisN = ai === cfg.rngs.length-1 ? lastN : eachN;
                    encs.push(getEncoder('scalar', {
                        n: thisN,
                        w: Math.floor(cfg.w*thisN),
                        min: cfg.rngs[ai][0],
                        max: cfg.rngs[ai][1]
                    }));
                }

                return function(value) {
                    var ret = [];
                    for (var ai = 0; ai < cfg.rngs.length; ai++) {
                        ret = ret.concat(encs[ai](value[ai]));
                    }
                    return ret;
                }
            })()
        };

        if (encoders.hasOwnProperty(type)) {
            return encoders[type];
        } else {
            return function() {
                return false;
            }
        }
    }

    /********************
     * helper functions */
    function getRandPerm(n) {
        var sorted = [];
        for (var ai = 0; ai < n; ai++) {
            sorted.push(ai);
            var idx = Math.floor(ai*Math.random());
            sorted[ai] = sorted[idx];
            sorted[idx] = ai;
        }
        return sorted;
    }

    return {
        SP: SpatialPooler
    };
})();
