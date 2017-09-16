/**
 * Created by mjsmcp on 9/16/17.
 */
Array.prototype.unique1 = function()
{
    var n = [];
    for(var i = 0; i < this.length; i++)
    {
        if (n.indexOf(this[i]) === -1) n.push(this[i]);
    }
    return n;
};