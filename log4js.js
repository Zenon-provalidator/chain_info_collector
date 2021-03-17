const log4js = require('log4js')

//logger
log4js.configure({
    appenders: { 
    	chain_info_collector: { 
			type: 'dateFile', 
			filename: './chain_info_collector.log',
		    compress: true
    	} 
    },
    categories: { 
    	default: { 
    		appenders: ['chain_info_collector'], 
    		level: 'debug' 
    	} 
    }
})

const logger = log4js.getLogger('chain_info_collector')

// console.log(logger)
module.exports = {
   log4js : logger
}