console.log(`import.meta: `, import.meta)
const {url, resolve} = import.meta

import { is, isnot, arr, fn, match, num, obj, _do, _try, not} from '../Modules/Pattern_Matching.mjs'
import { IPv4, RoutingTableNG } from "./ClassIPv4.mjs";
import { RoutingTable_v3 } from "./classRoutingTable.v3.mjs";
import { deepEqualFast } from "./DeepValues.mjs";
import { doTest, runTests } from "../../test/ClassQATestSuite.mjs";
import { dedent } from "./dedent.mjs";

globalThis.consolidate = RoutingTableNG.consolidate


//const { should, assert:assert2, Should, expect, util } = await import('../../node_modules/chai/chai.js')

//const {
//	runTest,
//	runTests,
//	QATestSuite,
//	doTest,
//} = await import('../../test/ClassQATestSuite.mjs')


const possibleImportPaths = [
	'../../test',
	'./',
	'./static/Modules',
	'./Modules',
	'../Modules',
	'./static',
]

const moduleNames = [
	'ClassQATestSuite.mjs',
	'classRoutingTable.v3.mjs',
	'ClassIPv4.mjs',
	'DeepValues.mjs',
	'Pattern_Matching.mjs',
]


function importModuleFromUnknownPaths_prev(possibleImportPaths, moduleName, functionNames) {
	const fnName = `importModuleFromUnknownPaths_prev`
	
  const promiseToImportModule = Promise.any(possibleImportPaths.map( (pathStr) => pathStr.trim().replace(/.*\/$/, "")).map( (cleanedPathStr) =>  { 
		console.log(`[${fnName}]: Attempting import of ${moduleName} using path ${cleanedPathStr}...` )
		import(`${cleanedPathStr}/${moduleName}`) 
	}))
	.then( (importedModule) => {
		console.log(`[${fnName}]: Successfully imported ${moduleName}` )
	  for (const exportedFunctionName of Object.keys(importedModule)) {
			if (functionNames.includes(exportedFunctionName) && globalThis[exportedFunctionName] === undefined) {
				globalThis[exportedFunctionName] = importedModule[exportedFunctionName];
				console.log(`[${fnName}]: imported function '${exportedFunctionName}' from module, now in global space`);
			}
	  }
	})
	.catch((importError) => {
  	console.log(`[${fnName}]: Failed import, trying next path`, { importError });
  });

	return promiseToImportModule
}



function importModuleFromUnknownPaths(possibleImportPaths, moduleName, functionNames) {
	const fnName = `importModuleFromUnknownPaths`
	const possibleImportPathsCleaned = possibleImportPaths.map( (pathStr) => pathStr.trim().replace(/.*\/$/, ""))
	globalThis.globalImports = {}

  const promiseToImportModule = Promise.any(
		possibleImportPathsCleaned.map( async (cleanedPathStr) =>  {
			const importedModule = await import(`${cleanedPathStr}/${moduleName}`)
			return {
				cleanedPathStr,
				moduleName,
				importedModule,
			}
		})
	)
	.then( ({ cleanedPathStr, moduleName, importedModule }) => {
		globalThis.globalImports[moduleName] = importedModule
		console.log(`[${fnName}]: Module '${moduleName}': `)
		console.log(`  imported on relative path '${cleanedPathStr}'.  Extracting the provided function names into global space...`)
	  for (const exportedFunctionName of Object.keys(importedModule)) {
			if (globalThis[exportedFunctionName]) {
        console.log(`  function '${exportedFunctionName}' already exists in the global namespace.  Use 'globalThis.globalImports.${exportedFunctionName}' instead...`)
			}
			if (functionNames.includes(exportedFunctionName)) {
				globalThis[exportedFunctionName] = importedModule[exportedFunctionName];
        console.log(`  function '${exportedFunctionName}' from module '${moduleName}' added into the global namespace.`)
			}
	  }
	})
	.catch((importError) => {
  	console.log(`[${fnName}]: Failed to import import the module '${moduleName}' on any of the supplied paths...`, { importError });
  });
	return promiseToImportModule
}


function importModulesFromUnknownPaths(possibleImportPaths, moduleNames, functionNames) {
	const fnName = `importModulesFromUnknownPaths`
	return Promise.allSettled(moduleNames.map((moduleName) => importModuleFromUnknownPaths(possibleImportPaths, moduleName, functionNames)))
		.then( (importAttempts) => {
			const successfulImports = importAttempts.filter((result) => result.status === 'fulfilled');
			const failedImports = importAttempts.filter((result) => result.status === 'rejected');
			if (successfulImports.length == moduleNames.length) {
				console.log(`[${fnName}]: Successfully imported all ${moduleNames.length} modules:`)
			}
			else {
				console.log(`[${fnName}]: ${failedImports.length}/${moduleNames.length} modules failed to import:`, failedImports.map((result) => result.reason))
			}
		})
		.catch((error) => {
			console.log(`[${fnName}]: Major error!  Should never see this:`, error);
			throw new Error('[${fnName}]: Major error!  Should never see this', { cause: error });
		});
}


//await importModulesFromUnknownPaths(possibleImportPaths, moduleNames, ['IPv4', 'RoutingTableNG', 'deepEqualFast', 'is', 'jagerFn']);
await importModulesFromUnknownPaths(possibleImportPaths, moduleNames, [
	'IPv4', 
	'deepEqualFast', 
	'is',
	'RoutingTable', 
	'RoutingTableNG',
	'RoutingTable_v3',
	'runTest',
	'runTests',
	'QATestSuite',
	'doTest',
	'scanContiguousPrefixes',
	'sortPrefixes',
	'generateMasksFor',
	'generateSupernetsFor',
	'consolidateAdjacent'
]);

globalThis.RoutingTableTest = RoutingTable_v3
//globalThis.RoutingTableTest = RoutingTableNG



// NOTE: assert seems to behave like it will only throw for falsey values (null, undefined, empty string, NaN, false, and 0).
//       we won't want it do assert on 0, I think.  Using homemade assert using is.empty(val) is probalby a better one
const assert_prev = (value, message="") => { 
	if ( value===false || is.empty(value) ) { 
		throw new Error(`${message}`) 
	}
}

const assert = (value, msgOnError='') => {
	if ( value===false || is.empty(value) ) {
		//throw new Error(msgOnError, { cause: `assertion error: supplied value '${value}' (${typeof(value)==='object' ? value.constructor.name : typeof(value)}) is not truthy` })
		throw new Error(`Failed assertion`, {cause: msgOnError})
	}
}

/** NEW TESTS - class IPv4*/

globalThis.assert = assert

// Mock Deno namespace for browser context
if (typeof window !== 'undefined' && !window.Deno) {
	console.log('****************** - running in a browser context')
  window.Deno = {
    tests: [],
		successes: [],
		failures: [],
    test: function (name, fn) {
      this.tests.push({ name, fn });
    },
		successReport: (logFn=console.log) => {
			for (const testName of Deno.successes) {
				logFn(`✅ Passed test: '${testName}'`)
			}
		},
		failureReport: (logFn=console.log) => {
			const resultsByTestName = Object.groupBy(Deno.failures, ({name})=>name)
			for (const testName in resultsByTestName) {
				logFn(`❌ Failed test: '${testName}`)
				for ( const { name, errorMessage, cause, failedAt } of resultsByTestName[testName] ) {
					//logFn(' Error: ', errorMessage.padEnd(10), `Cause: `, cause?.padEnd(20)??'check log', `at: `, {cause, failedAt})
					const [errorType, ...stack] = failedAt
					logFn(`Name: ${name}, Error: ${errorMessage}, Cause: ${cause}, at:`, {cause, failedAt: stack})
					//logFn('Name:', name, ' Error: ', errorMessage, `Cause: `, cause, `at: `, {cause, failedAt})
				}
			}
		},
    runTests: async () => {
      for (const { name, fn } of Deno.tests) {
        try {
          await fn();
					Deno.successes.push(name)
          //console.log(`✅ ${name}`);
        } catch (error) {
					const stackLines = error.stack.split('\n')
					Deno.failures.push({
						name, 
						errorMessage: error.message, 
						cause: error?.cause ?? '', 
						failedAt: stackLines,
						//failedAt: stackLines[1].trim()
					})
          //console.log(`❌ ${name}`);
          //console.error(error);
        }
      }
    }
  };
}


Deno.test("IPv4 constructor with valid string-based IP and length-based mask", () => {
	const ip = new IPv4('192.168.1.1/24');
	assert(ip.addr === 0xC0A80101, "Address should be 192.168.1.1");
	assert(ip.mask === 0xFFFFFF00, "Mask should be 255.255.255.0");
	assert(ip.error === '', "Error should be empty");
	
});

Deno.test("IPv4 constructor with valid string-based IP and dotted-decimal mask", () => {
	const ip = new IPv4('192.168.1.1/24');
	assert(ip.addr === 0xC0A80101, "Address should be 192.168.1.1");
	assert(ip.mask === 0xFFFFFF00, "Mask should be 255.255.255.0");
	assert(ip.error === '', "Error should be empty");
});

Deno.test("IPv4 constructor with invalid IP", () => {
	const ip = new IPv4('999.999.999.999');
	assert(ip.isInvalid(), "Should be an error instance");
	assert(ip.error.includes("Invalid IP address string supplied:"));
	assert(ip.addr === 0xFFFFFFFF, "Address should be all 1s");
	assert(ip.mask === 0xFFFFFFFF, "Mask should be all 1s");
});

Deno.test("IPv4 constructor with invalid Mask", () => {
	const ip = new IPv4('10.10.10.0/33');
	assert(ip.isInvalid(), "Should be an error instance");
	assert(ip.error.includes("Invalid subnet mask supplied:"));
	assert(ip.addr === 0xFFFFFFFF, "Address should be all 1s");
	assert(ip.mask === 0xFFFFFFFF, "Mask should be all 1s");
});

Deno.test("IPv4 constructor with invalid Mask", () => {
	const ip = new IPv4('10.10.10.0/25.255.255.0');
	assert(ip.isInvalid(), "Should be an error instance");
	assert(ip.error.includes("Invalid subnet mask supplied:"));
	assert(ip.addr === 0xFFFFFFFF, "Address should be all 1s");
	assert(ip.mask === 0xFFFFFFFF, "Mask should be all 1s");
});

Deno.test("IPv4 constructor with another IPv4 instance", () => {
	const ip1 = new IPv4('192.168.1.1/24');
	const ip2 = new IPv4(ip1);
	assert(ip2.addr === ip1.addr, "Address should be the same as ip1");
	assert(ip2.mask === ip1.mask, "Mask should be the same as ip1");
	assert(ip2.error === ip1.error, "Error should be the same as ip1");
});

Deno.test("IPv4 getPrefixLength method", () => {
	const ip = new IPv4('192.168.1.1/24');
	assert(ip.getMaskLength() === 24, "Prefix length should be 24");
});

Deno.test("IPv4 isNetwork method", () => {
	const ip = new IPv4('192.168.1.0/24');
	assert(ip.isNetwork(), "Should be a network address");
});

Deno.test("IPv4 getBaseNetwork method", () => {
	const ip = new IPv4('192.168.1.1/24');
	const baseNetwork = ip.getNetwork();
	assert(baseNetwork.addr === 0xC0A80100, "Base network address should be 192.168.1.0");
	assert(baseNetwork.mask === 4294967040, "Base network mask should be /24")
});

Deno.test("IPv4 getBroadcastAddr method", () => {
	const ip = new IPv4('192.168.1.1/24');
	const broadcastAddr = ip.getBroadcast();
	assert(broadcastAddr.addr === 3232236031, "Broadcast address should be 192.168.1.255");
});

Deno.test("IPv4 getOffset_fromNetwork method", () => {
	const ip1 = new IPv4('192.168.1.222/16')
	assert(ip1.getOffset_fromNetwork() === 478, "Offset from network should be 478");
	const ip2 = new IPv4('192.168.1.0/24')
	assert(ip2.getOffset_fromNetwork() === 0, "Offset from network should be 0");
});

Deno.test("IPv4 isSubnetOf method", () => {
	const ip = new IPv4('192.168.1.1/24');
	assert(ip.isSubnetOf('192.168.1.0/24'), "Should be a subnet of 192.168.1.0/24");
});

Deno.test("IPv4 isSupernetOf method", () => {
	const ip = new IPv4('192.168.1.0/24');
	assert(ip.isSupernetOf('192.168.1.0/25'), "Should be a supernet of 192.168.1.0/25");
});


/** PREVIOUS TESTS */
//////////////////////////////////////////////////////////////////////////

Deno.test("IPv4 - Parsing and Validation", () => {
  const ip1 = new IPv4('192.168.1.1/24');
  assert(!ip1.error);
  assert(deepEqualFast(ip1.addr, 3232235777))
  assert(deepEqualFast(ip1.maskLen(), 24))
  assert(deepEqualFast(ip1.mask, 0xFFFFFF00))

  const ip2 = new IPv4('256.256.256.256');
  assert(ip2.error);
});


Deno.test("IPv4 - Subnet and Supernet Identification", () => {
  const ip1 = new IPv4('192.168.1.0/24');
  const ip2 = new IPv4('192.168.1.128/25');
  assert(ip2.isSubnetOf('192.168.1.0/24'));
  assert(ip1.isSupernetOf('192.168.1.128/25'));
});


Deno.test("IPv4 - IP Address to String Conversion", () => {
  const ip = new IPv4('192.168.1.1/24').getNetwork();
  assert(deepEqualFast(ip.toString(), '192.168.1.0/24'));
});


Deno.test("IPv4 - Creating Prefixes Between IP Addresses - default (exclusive)", () => {
  /* correct way - excludes the 192.168.2.0/32 prefix */
  const properUse = IPv4.createPrefixesBetween('192.168.1.0', '192.168.2.0');      
  /* unintended way - if expecting a /24, you need to use the {inclusive:false} flag in the method */
  const improperUse = IPv4.createPrefixesBetween('192.168.1.0', '192.168.1.255');  

  assert(deepEqualFast(properUse.length, 1));
  assert(deepEqualFast(properUse[0].toString(), '192.168.1.0/24'));
  assert(deepEqualFast(improperUse.length, 8));
  assert(deepEqualFast(
    improperUse.map( (ipv4)=>ipv4.toString() ),
    [
      "192.168.1.0/25",
      "192.168.1.128/26",
      "192.168.1.192/27",
      "192.168.1.224/28",
      "192.168.1.240/29",
      "192.168.1.248/30",
      "192.168.1.252/31",
      "192.168.1.254/32"
    ]
  ))
});


Deno.test("IPv4 - Creating Prefixes Between IP Addresses - using ({inclusive:true})", () => {
  // correct way - when inclusive==true, the 2nd address is actually part of the range
  const properUse = IPv4.createPrefixesBetween('192.168.1.0', '192.168.1.255', {inclusive:true});
  // unintended way - when inclusive==true, you will add a 192.168.2.0/32 to the list
  const improperUse = IPv4.createPrefixesBetween('192.168.1.0', '192.168.2.0', {inclusive:true});

  assert(deepEqualFast(properUse.length, 1));
  assert(deepEqualFast(properUse[0].toString(), '192.168.1.0/24'));
  assert(deepEqualFast(improperUse.length, 2));
  assert(deepEqualFast(
    improperUse.map( (ipv4)=>ipv4.toString()), 
    [
      "192.168.1.0/24",
      "192.168.2.0/32"
    ]
  ))
});



Deno.test("IPv4 - Parsing small range of prefixes - terse syntax", () => {
  const prefixes1 = IPv4.parseRange('192.168.1.1-10');
  const prefixes2 = IPv4.parseRange('192.168.1.1 - 10');

  assert(deepEqualFast(prefixes1.length, 5));
  assert(deepEqualFast(
    prefixes1.map((ipv4)=>ipv4.toString()), 
    [
      "192.168.1.1/32",
      "192.168.1.2/31",
      "192.168.1.4/30",
      "192.168.1.8/31",
      "192.168.1.10/32"
    ]
  ));

  assert(deepEqualFast(prefixes2.length, 5));
  assert(deepEqualFast(
    prefixes2.map((ipv4)=>ipv4.toString()), 
    [
      "192.168.1.1/32",
      "192.168.1.2/31",
      "192.168.1.4/30",
      "192.168.1.8/31",
      "192.168.1.10/32"
    ]
  ));
});


Deno.test("IPv4 - Parsing small range of prefixes - full syntax", () => {
  const prefixes1 = IPv4.parseRange('192.168.1.1-192.168.1.10');
  const prefixes2 = IPv4.parseRange('192.168.1.1 -  192.168.1.10');

  assert(deepEqualFast(prefixes1.length, 5));
  assert(deepEqualFast(
    prefixes1.map((ipv4)=>ipv4.toString()), 
    [
      "192.168.1.1/32",
      "192.168.1.2/31",
      "192.168.1.4/30",
      "192.168.1.8/31",
      "192.168.1.10/32"
    ]
  ));

  assert(deepEqualFast(prefixes2.length, 5));
  assert(deepEqualFast(
    prefixes2.map((ipv4)=>ipv4.toString()), 
    [
      "192.168.1.1/32",
      "192.168.1.2/31",
      "192.168.1.4/30",
      "192.168.1.8/31",
      "192.168.1.10/32"
    ]
  ));
});



Deno.test("RoutingTable - Matching Prefixes (.hasRouteFor)", () => {
  const routes = [
    new IPv4('192.168.1.0/24', 'data1'),
    new IPv4('192.168.2.0/24', 'data2'),
    new IPv4('192.168.1.128/25', 'data3')
  ];
  const routingTable = new RoutingTableTest(routes);

  // supplied host route matches table
  assert(routingTable.hasRouteFor('192.168.1.1'));
  assert(routingTable.hasRouteFor(new IPv4('192.168.1.1')));

  // supplied route matches table
  assert(routingTable.hasRouteFor('192.168.2.0/25'));
  assert(routingTable.hasRouteFor(new IPv4('192.168.2.0/25')));

  // supplied route is subnet of table
  assert(routingTable.hasRouteFor('192.168.2.2/31'));
  assert(routingTable.hasRouteFor(new IPv4('192.168.2.2/31')));

  // expected failure: supplied route not in table
  assert(!routingTable.hasRouteFor('192.168.3.1'));
  assert(!routingTable.hasRouteFor(new IPv4('192.168.3.1')));

  // expected failure: supplied route is /21 subnet - 192.168.2.x is a /24
  assert(!routingTable.hasRouteFor('192.168.2.2/21'));
  assert(!routingTable.hasRouteFor(new IPv4('192.168.2.2/21')));
});



Deno.test("RoutingTable - Longest Match Prefix", () => {
  const routes = [
    new IPv4('192.168.1.0/24', 'data1'),
    new IPv4('192.168.2.0/24', 'data2'),
    new IPv4('192.168.1.128/25', 'data3')
  ];
  const routingTable = new RoutingTableTest(routes);

  const match = routingTable.getLongestMatchPrefix('192.168.1.200');
  assert(deepEqualFast(match.data, ['data3']));
});


Deno.test("RoutingTable - All Matching Prefixes", () => {
  const routes = [
    new IPv4('192.168.1.0/24', 'data1'),
    new IPv4('192.168.2.0/24', 'data2'),
    new IPv4('192.168.1.128/25', 'data3')
  ];
  const routingTable = new RoutingTableTest(routes);

  const matches = routingTable.getMatchingPrefixes('192.168.1.200');
  assert(deepEqualFast(matches.length, 2));
});


Deno.test("RoutingTable - First Match", () => {
  const routes = [
    new IPv4('192.168.1.0/24',   'data1'),
    new IPv4('192.168.2.0/24',   'data2'),
    new IPv4('192.168.1.128/25', 'data3')
  ];
  const routingTable = new RoutingTableTest(routes);

  const firstMatch = routingTable.getFirstMatchPrefix('192.168.1.200');
  assert(deepEqualFast(firstMatch.data, ['data1']))
});


Deno.test("RoutingTable - Duplicate Routes - simple data", () => {
  const routes = [
    new IPv4('192.168.1.0/24',   'data1-b' ),
    new IPv4('192.168.1.0/24',   'data1-c' ),
    new IPv4('192.168.1.0/24',   'data1-d' ),
    new IPv4('192.168.2.0/24',   'data2'   ),
    new IPv4('192.168.1.128/25', 'data3'   ),
		new IPv4('192.168.1.0/24',   'data1-a' ),
  ];
  const routingTable = new RoutingTableTest(routes);

	const longestMatch1 = routingTable.getLongestMatchPrefix('192.168.1.200');
  assert(deepEqualFast(longestMatch1.data, ['data3']))

	const longestMatch2 = routingTable.getLongestMatchPrefix('192.168.2.0/24');
  assert(deepEqualFast(longestMatch2.data, ['data2']))

	const longestMatch3 = routingTable.getLongestMatchPrefix('192.168.2.0/25');
  assert(deepEqualFast(longestMatch3.data, ['data2']))

	const longestMatch4 = routingTable.getLongestMatchPrefix('192.168.2.0/23');
  assert(deepEqualFast(longestMatch4, null))

  const longestMatch5 = routingTable.getLongestMatchPrefix('192.168.1.1');
  assert(deepEqualFast(
    longestMatch5.data.toSorted(), 
    ['data1-a', 'data1-b', 'data1-c', 'data1-d']
  ))
});



Deno.test("RoutingTable - Duplicate Routes - object data", () => {
  const routes_old = [
    new IPv4('192.168.1.10/32',   {name:'data1-a', original:'192.168.1.10/32'}),
    new IPv4('192.168.1.1/32',     {name:'data1-b', original:'192.168.1.1/32'}),
    new IPv4('192.168.1.2/32',     {name:'data1-c', original:'192.168.1.2/32'}),
    new IPv4('192.168.1.3/32',     {name:'data1-d', original:'192.168.1.3/32'}),
    new IPv4('192.168.1.0/24',     {name:'data1-sum', original:'192.168.1.0/24'}),
    new IPv4('192.168.2.0/24',     {name:'data2', original:'192.168.2.0/24'}),
    new IPv4('192.168.1.128/25',  {name:'data3', original:'192.168.1.128/25'} )
  ];
	const routes = [
    new IPv4('192.168.1.0/24',   {name:'data1-b', original: '192.168.1.0/24' }),
    new IPv4('192.168.1.0/24',   {name:'data1-c', original: '192.168.1.0/24' }),
    new IPv4('192.168.1.0/24',   {name:'data1-d', original: '192.168.1.0/24' }),
    new IPv4('192.168.2.0/24',   {name:'data2'  , original: '192.168.2.0/24' }),
    new IPv4('192.168.1.128/25', {name:'data3'  , original: '192.168.1.128/25',}),
		new IPv4('192.168.1.0/24',   {name:'data1-a', original: '192.168.1.0/24' }),

	]
  const routingTable = new RoutingTableTest(routes)
  const longestMatch = routingTable.getLongestMatchPrefix('192.168.1.1')
  assert(deepEqualFast(
		longestMatch.data.map(x=>x.name).toSorted(),
		['data1-a', 'data1-b', 'data1-c', 'data1-d']
	))
});


Deno.test("RoutingTable - Consolidate - simple data", () => {
  const routes = [
    new IPv4('192.168.1.10/32',   'data1-a'  ),
    new IPv4('192.168.1.1/32',    'data1-b'  ),
    new IPv4('192.168.1.2/32',    'data1-c'  ),
    new IPv4('192.168.1.3/32',    'data1-d'  ),
    new IPv4('192.168.1.0/24',    'data1-sum'),
    new IPv4('192.168.2.0/24',    'data2'    ),
    new IPv4('192.168.1.128/25',  'data3'    )
  ];
  const routingTable = new RoutingTableTest(routes)
	const routingTableC =routingTable.consolidate()
  const longestMatch = routingTable.getLongestMatchPrefix('192.168.1.1/32')
	const longestMatchC = routingTableC.getLongestMatchPrefix('192.168.1.1/32')
	assert(deepEqualFast(longestMatch.data, ['data1-b']))
	assert(deepEqualFast(longestMatchC.data.toSorted(), ['data1-sum', 'data3', 'data1-a', 'data1-d', 'data1-c', 'data1-b'].toSorted()))
});


Deno.test("RoutingTable - Consolidate - object data", () => {
  const routes = [
    new IPv4('192.168.1.10/32',    {name:'data1-a'    , original:'192.168.1.10/32'}    ),
    new IPv4('192.168.1.1/32',     {name:'data1-b'    , original:'192.168.1.1/32'}    ),
    new IPv4('192.168.1.2/32',     {name:'data1-c'    , original:'192.168.1.2/32'}    ),
    new IPv4('192.168.1.3/32',     {name:'data1-d'    , original:'192.168.1.3/32'}    ),
    new IPv4('192.168.1.0/24',     {name:'data1-sum'  , original:'192.168.1.0/24'}    ),
    new IPv4('192.168.2.0/24',     {name:'data2'      , original:'192.168.2.0/24'}    ),
    new IPv4('192.168.1.128/25',   {name:'data1-e'     , original:'192.168.1.128/25'} )
  ];
  const routingTable = new RoutingTableTest(routes)
	const routingTableC = routingTable.consolidate()
  const longestMatch = routingTable.getLongestMatchPrefix('192.168.1.1/32')
	const longestMatchC = routingTableC.getLongestMatchPrefix('192.168.1.1/32')
  assert(deepEqualFast(longestMatchC.data.toSorted( /** @param {{name:string, original:string}} o1  @param {{name:string, original:string}} o2 */ (o1,o2)=>o1.name.localeCompare(o2.name)), [
    {name:'data1-a'    , original:'192.168.1.10/32'},
    {name:'data1-b'    , original:'192.168.1.1/32'},
    {name:'data1-c'    , original:'192.168.1.2/32'},
    {name:'data1-d'    , original:'192.168.1.3/32'},
    {name:'data1-e'    , original:'192.168.1.128/25'},
		{name:'data1-sum'  , original:'192.168.1.0/24'},  
  ]))
	assert(deepEqualFast(longestMatch.data.toSorted( (o1,o2)=>(o1,o2)=>o1.name.localeCompare(o2.name)), [{name:'data1-b', original:'192.168.1.1/32'}]))
});


Deno.test("RoutingTable - Consolidate test 2 - object data", () => {
  const routes = [
    new IPv4('192.168.1.10/32',    {name:'data1-a'    , original:'192.168.1.10/32'}    ),
    new IPv4('192.168.1.1/32',     {name:'data1-b'    , original:'192.168.1.1/32'}    ),
    new IPv4('192.168.1.2/32',     {name:'data1-c'    , original:'192.168.1.2/32'}    ),
    new IPv4('192.168.1.3/32',     {name:'data1-d'    , original:'192.168.1.3/32'}    ),
    new IPv4('192.168.1.0/30',     {name:'data1-sum'  , original:'192.168.1.0/30'}    ),
    new IPv4('192.168.2.0/24',     {name:'data2'      , original:'192.168.2.0/24'}    ),
    new IPv4('192.168.1.128/25',   {name:'data1-e'     , original:'192.168.1.128/25'} )
  ];
  const routingTable = new RoutingTableTest(routes)
	const routingTableC = routingTable.consolidate()
  const longestMatch = routingTable.getLongestMatchPrefix('192.168.1.1/32')
	const longestMatchC = routingTableC.getLongestMatchPrefix('192.168.1.1/32')
  assert(deepEqualFast(longestMatchC.data.toSorted( /** @param {{name:string, original:string}} o1  @param {{name:string, original:string}} o2 */ (o1,o2)=>o1.name.localeCompare(o2.name)), [
    {name:'data1-b'    , original:'192.168.1.1/32'},
    {name:'data1-c'    , original:'192.168.1.2/32'},
    {name:'data1-d'    , original:'192.168.1.3/32'},
		{name:'data1-sum'  , original:'192.168.1.0/30'},  
  ]))
	assert(deepEqualFast(longestMatch.data.toSorted( (o1,o2)=>(o1,o2)=>o1.name.localeCompare(o2.name)), [{name:'data1-b', original:'192.168.1.1/32'}]))
});


Deno.test("[consolidate]: complex scenario", () => {
	const routes = [
		new IPv4("192.168.1.0/24" , "192.168.1.0/24" ),
		new IPv4("192.168.2.99/32", "192.168.2.99/32"),
		new IPv4("192.168.0.0/25" , "192.168.0.0/25" ),
		new IPv4("192.168.2.0/24" , "192.168.2.0/24" ),
		new IPv4("192.168.0.0/24" , "192.168.0.0/24" ),
	]
  const routingTable = new RoutingTableTest(routes)
	const routingTableC = routingTable.consolidate()

})


Deno.test("Constructors with data  ", () => {
	const dataTests = [
		'meco',
		false,
		4905,
		{name:'meco', breed:'cat'},
		['meco'],
		[{name:'meco', breed:'cat'}],
		null,
		globalThis.i_dont_exist
	]	

	// constructing via string prefixes & various forms of data - only undefined values become null
	assert (  deepEqualFast(new IPv4('192.168.1.0/24', dataTests[0]).data, dataTests[0] )  )    // 'meco'
	assert (  deepEqualFast(new IPv4('192.168.1.0/24', dataTests[1]).data, dataTests[1] )  )    // false
	assert (  deepEqualFast(new IPv4('192.168.1.0/24', dataTests[2]).data, dataTests[2] )  )    // 4905
	assert (  deepEqualFast(new IPv4('192.168.1.0/24', dataTests[3]).data, dataTests[3] )  )    // {name:'meco', breed:'cat'}
	assert (  deepEqualFast(new IPv4('192.168.1.0/24', dataTests[4]).data, dataTests[4] )  )    // ['meco']
	assert (  deepEqualFast(new IPv4('192.168.1.0/24', dataTests[5]).data, dataTests[5] )  )    // [{name:'meco', breed:'cat'}]
	assert (  deepEqualFast(new IPv4('192.168.1.0/24', dataTests[6]).data, dataTests[6] )  )    // null
	assert (  deepEqualFast(new IPv4('192.168.1.0/24', dataTests[7]).data, null )  )            // undefined value becomes null

  // constructing via IPv4 instances & various forms of data - undefined values become null, and objects have a copied:true added to them (this may be removed)
	assert (  deepEqualFast(  new IPv4(new IPv4('192.168.1.0/24', dataTests[0])).data, dataTests[0] )  )                        // 'meco'
	assert (  deepEqualFast(  new IPv4(new IPv4('192.168.1.0/24', dataTests[1])).data, dataTests[1] )  )                        // false
	assert (  deepEqualFast(  new IPv4(new IPv4('192.168.1.0/24', dataTests[2])).data, dataTests[2] )  )                        // 4905
	assert (  deepEqualFast(  new IPv4(new IPv4('192.168.1.0/24', dataTests[3])).data, { copied:true, ...dataTests[3] } )  )    // {name:'meco', breed:'cat'}
	assert (  deepEqualFast(  new IPv4(new IPv4('192.168.1.0/24', dataTests[4])).data, dataTests[4] )  )                        // ['meco']
	assert (  deepEqualFast(  new IPv4(new IPv4('192.168.1.0/24', dataTests[5])).data, dataTests[5] )  )                        // [{name:'meco', breed:'cat'}]
	assert (  deepEqualFast(  new IPv4(new IPv4('192.168.1.0/24', dataTests[6])).data, dataTests[6] )  )                        // null
	assert (  deepEqualFast(  new IPv4(new IPv4('192.168.1.0/24', dataTests[7])).data, null )  )                                // undefined value becomes null
})



Deno.test("[consolidate]: varying patterns", () => {
	const routesStr = [
		'172.20.2.0/23',
		'172.20.4.0/23',
		'172.20.6.0/24',
		'10.0.1.0/24',
		'169.254.0.0/16',
		'172.20.0.0/23',
		'172.20.7.0/24',
		'172.20.8.0/21',
		'172.20.16.0/20',
		'172.20.32.0/19',
		'172.20.64.0/18',
		'172.20.128.0/17',
		'172.21.0.0/16',
		'172.22.0.0/15',
		'172.24.0.0/13'
	]

	const routesIPv4 = [
		new IPv4('172.20.2.0/23'),
		new IPv4('172.20.4.0/23'),
		new IPv4('172.20.6.0/24'),
		new IPv4('10.0.1.0/24'),
		new IPv4('169.254.0.0/16'),
		new IPv4('172.20.0.0/23'),
		new IPv4('172.20.7.0/24'),
		new IPv4('172.20.8.0/21'),
		new IPv4('172.20.16.0/20'),
		new IPv4('172.20.32.0/19'),
		new IPv4('172.20.64.0/18'),
		new IPv4('172.20.128.0/17'),
		new IPv4('172.21.0.0/16'),
		new IPv4('172.22.0.0/15'),
		new IPv4('172.24.0.0/13')
	]

	const rt_str = new RoutingTableTest(routesStr)
	const rt_obj = new RoutingTableTest(routesIPv4)
	
  const rt_str_c = rt_str.consolidate()
	const rt_obj_c = rt_obj.consolidate()
		

	assert (
		deepEqualFast(rt_str.prefixTable, rt_obj.prefixTable)
	)
	assert (
		deepEqualFast(rt_str_c.orderedTable, rt_obj_c.orderedTable)
	)

})




















const runMoreTests = () => {
	const tests = [
		{
			name:  'IPv4 constructor - no mask',
			expect: ()=>new IPv4('192.168.1.0').toString(),
			toBe: `192.168.1.0/32`,
		},
		{
			name:  'IPv4 constructor w/mask length',
			expect: ()=>new IPv4('192.168.1.0/24').toString(),
			toBe: `192.168.1.0/24`,
		},
		{
			name:  'IPv4 constructor w/mask',
			expect: ()=>new IPv4('192.168.1.0/255.255.0.0').toString(),
			toBe: `192.168.1.0/16`,
		},
		{
			name:  'IPv4 constructor w/Inv mask',
			expect: ()=>new IPv4().parse_wInvertedMask('192.168.0.0/0.0.255.255').toString(),
			toBe: `192.168.0.0/16`,
		},
		{
			name:  'IPv4::isSubnetOf - positive test',
			expect: ()=>new IPv4('192.168.1.0/24').isSubnetOf('192.168.0.0/16'),
			toBe: true,
		},
		{
			name:  'IPv4::isSubnetOf - negative test',
			expect: ()=>new IPv4('192.168.1.0/24').isSubnetOf('172.16.1.0/28'),
			toBe: false,
		},
		{
			name:  'IPv4::isSubnetOf - default route',
			expect: ()=>new IPv4('192.168.1.0/24').isSubnetOf('0.0.0.0/0'),
			toBe: true,
		},
		{
			name:  'IPv4::isSubnetOf - self test',
			expect: ()=>new IPv4('192.168.1.0/24').isSubnetOf('192.168.1.0/24'),
			toBe: true,
		},
		{
			name:  'IPv4::isSubnetOf - self test w/default',
			expect: ()=>new IPv4('0.0.0.0/0').isSubnetOf('0.0.0.0/0'),
			toBe: true,
		},
		{
			name:  'IPv4::isSupernetOf - positive test',
			expect: ()=>new IPv4('192.168.1.0/24').isSupernetOf('192.168.1.0/28'),
			toBe: true,
		},
		{
			name:  'IPv4::isSupernetOf - negative test',
			expect: ()=>new IPv4('192.168.1.0/24').isSupernetOf('172.16.1.0/28'),
			toBe: false,
		},
		{
			name:  'IPv4::isSupernetOf - self test',
			expect: ()=>new IPv4('192.168.1.0/28').isSupernetOf('192.168.1.0/28'),
			toBe: true,
		},
		{
			name:  'IPv4::isSupernetOf - self test w/default',
			expect: ()=>new IPv4('0.0.0.0/0').isSupernetOf('0.0.0.0/0'),
			toBe: true,
		},
		{
			name:  'IPv4.network_fromRange() - IPs on network boundaries',
			expect: ()=>IPv4.network_fromRange('192.168.0.0','192.168.1.255').toString(),
			toBe: `192.168.0.0/23`,
		},
		{
			name:  'IPv4.network_fromRange() - IPs on obscure boundaries',
			expect: ()=>IPv4.network_fromRange('192.168.0.199','192.168.1.36').toString(),
			toBe: `192.168.0.0/23`,
		},
		{
			name:  'IPv4.network_fromRange() - forcing IP range to select entire 32-bit address space',
			expect: ()=>IPv4.network_fromRange('0.0.0.0','255.168.1.255').toString(),
			toBe: `0.0.0.0/0`,
		},
		{
			name:  'IPv4::getMaskLength()',
			expect: ()=>new IPv4('192.168.0.0/255.240.0.0').getMaskLength(),
			toBe: 12,
		},
		{
			name:  'IPv4::getBlockSize()',
			expect: ()=>new IPv4('192.168.1.64/255.255.255.192').getBlockSize(),
			toBe: 64,
		},
		{
			name:  'IPv4::getAddress_fromOffset()',
			expect: ()=>new IPv4('192.168.0.0/20').getAddress_fromOffset(1024).toString(),
			toBe: '192.168.4.0/20',
		},
		{
			name:  'IPv4::getAddress_fromOffset()',
			expect: ()=>new IPv4('0.0.0.0/0').getAddress_fromOffset(256**4-1).toString(),  // bit-shift 256 4 times to overrun 32-bit counter, minus 1 - give us all 1s
			toBe: '255.255.255.255/0',
		},
		{
			name:  'IPv4::getNetwork - nominal case 1 - constructor is a network address',
			expect: ()=>new IPv4('192.168.1.0/24').getNetwork().toString(),
			toBe: '192.168.1.0/24',
		},
		{
			name:  'IPv4::getNetwork - nominal case 2 - constructor is a network address',
			expect: ()=>new IPv4('0.0.0.0/0').getNetwork().toString(),
			toBe: '0.0.0.0/0',
		},
		{
			name:  'IPv4::getNetwork - case 1 - constructor is an interface address',
			expect: ()=>new IPv4('192.168.1.1/24').getNetwork().toString(),
			toBe: '192.168.1.0/24',
		},
		{
			name:  'IPv4::getNetwork - case 2 - constructor is an interface address',
			expect: ()=>new IPv4('192.168.1.1/8').getNetwork().toString(),
			toBe: '192.0.0.0/8',
		},
		//	quick explainer for "getNaturalNetwork()": TLDR:  an *inferred* subnet mask, given an address.
		//	Longer explanation: Given an IP address only, infer the *longest* subnet mask that can be applied to it, which would cause the value to be a network, 
		//	which will still make the value a network instead of a host address.  In other words, if you look at an addr with bits, how many continguous 0s from 
		//	the right can be counted?  That tells us our mask (natural mask)  
		{
			name:  'IPv4::getNaturalNetwork() - given an IP address only, infer the *longest* subnet mask which will still make the value a network instead of a host address',  
			expect: ()=>new IPv4('192.168.64.128').getNaturalNetwork().toString(),
			toBe: '192.168.64.128/25',
		},
		{
			name:  'IPv4::getBroadcast - case 1',
			expect: ()=>new IPv4('192.168.1.20/24').getBroadcast().toString(),
			toBe: '192.168.1.255/24',
		},
		{
			name:  'IPv4::getBroadcast - case 2',
			expect: ()=>new IPv4('192.168.1.20/16').getBroadcast().toString_addr(),
			toBe: '192.168.255.255',
		},
		{
			name:  'IPv4::getBroadcast - case 3',
			expect: ()=>new IPv4('0.0.0.0/0').getBroadcast().toString_addr(),
			toBe: '255.255.255.255',
		},
		{
			name:  'IPv4::toString()',
			expect: ()=>new IPv4('192.168.10.99/24').toString(),
			toBe: '192.168.10.99/24',
		},
		{
			name:  'IPv4::toString_addr()',
			expect: ()=>new IPv4('192.168.10.99/24').toString_addr(),
			toBe: '192.168.10.99',
		},
		{
			name:  'IPv4::toString_maskLen()  - showing that returnVal is NOT integer!!!',    
			expect: ()=>new IPv4('192.168.10.99/24').toString_maskLen(),
			toPassWith: (val) => (val !==24 && val==='24')
		},
		{
			name:  'IPv4::toString_maskLen()  - user-supplied function for loose-type-checking',    
			expect: ()=>new IPv4('192.168.10.99/24').toString_maskLen(),
			toPassWith: (val)=>val=='24',
		},
		{
			name:  'IPv4::toString_maskLen()  - returnVal is a string-based rep of integer!',
			expect: ()=>new IPv4('192.168.10.99/24').toString_maskLen(),
			toBe: '24',
		},
		{
			name:  'IPv4::toString_mask()',
			expect: ()=>new IPv4('192.168.10.99/24').toString_mask(),
			toBe: '255.255.255.0',
		},
		{
			name:  'IPv4::toString_inverseMask()',
			expect: ()=>new IPv4('192.168.10.99/24').toString_inverseMask(),
			toBe: '0.0.0.255',
		},
		{
			name:  'IPv4::toString_addr_binary()',
			expect: ()=>new IPv4('192.168.10.99/24').toString_binary_addr(),
			toBe: '0b11000000.10101000.00001010.01100011',
		},
		{
			name:  'IPv4::toString_binary_mask()',
			expect: ()=>new IPv4('192.168.10.99/24').toString_binary_mask(),
			toBe: '0b11111111.11111111.11111111.00000000',
		},
		{
			name:  'IPv4::toString_hex_addr()',
			expect: ()=>new IPv4('192.168.10.99/24').toString_hex_addr(),
			toBe: "0xc0a80a63",
		},
		{
			name:  'IPv4::toString_hex_mask()',
			expect: ()=>new IPv4('192.168.10.99/24').toString_hex_mask(),
			toBe: '0xffffff00'
		},
		{
			name:  'IPv4::createPrefixesBetweeen(inclusive is true)',
			expect: ()=>IPv4.createPrefixesBetween('192.168.1.0', '192.168.1.255', {inclusive:true}).toString(),
			toBe: `IPv4(192.168.1.0/24)`
		},
		{
			name:  'IPv4::createPrefixesBetweeen(inclusive is false)',
			expect: ()=>IPv4.createPrefixesBetween('192.168.1.0', '192.168.1.255', {inclusive:false}).toString(),
			toBe: "IPv4(192.168.1.0/25),IPv4(192.168.1.128/26),IPv4(192.168.1.192/27),IPv4(192.168.1.224/28),IPv4(192.168.1.240/29),IPv4(192.168.1.248/30),IPv4(192.168.1.252/31),IPv4(192.168.1.254/32)"
		},
		{
			name:  'IPv4::subnetGenerator',
			expect: ()=>{ const ipGen = IPv4.of('10.100.0.0/24').subnetGenerator(27); return [...ipGen].map((ip)=>ip.toString()).join(',\n')},
			toBe: dedent`
        10.100.0.0/27,
        10.100.0.32/27,
        10.100.0.64/27,
        10.100.0.96/27,
        10.100.0.128/27,
        10.100.0.160/27,
        10.100.0.192/27,
        10.100.0.224/27
      `
	},
	{
		name:  'IPv4::subnetGenerator',
		expect: ()=>{ const ipGen = IPv4.of('10.100.0.0/24').subnetGenerator(27); return [...ipGen].map((ip)=>ip.toString()).join(',\n')},
		toPassWith: (value) => value === dedent`
			10.100.0.0/27,
			10.100.0.32/27,
			10.100.0.64/27,
			10.100.0.96/27,
			10.100.0.128/27,
			10.100.0.160/27,
			10.100.0.192/27,
			10.100.0.224/27
		`
	},
	{
		name: 'RoutingTable.consolidate()',
		expect: () => {
			const routes = [
				new IPv4('192.168.0.0/24'),
				new IPv4('192.168.1.0/24'),
			]
			const rtng = new RoutingTableTest(routes).consolidate()
			return rtng
		},
		toPassWith: (result) => deepEqualFast(result.toString(), '192.168.0.0/23')
	},

]

	const testResults = runTests(tests)
	return testResults
}


globalThis.runMoreTests = runMoreTests

runMoreTests().reportAll()



//Deno.test("Invalid IPv4 Constructor Arguments", () => {
//  assertThrows(() => {
//    new IPv4("invalid/prefix");
//  });
//});




//	// Run the tests in the browser context
//	if (globalThis.window){
//	//  window.addEventListener('load', () => {
//	//		console.log('mark2')
//	//    Deno.runTests();
//	//  });
//		Deno.runTests();
//	}

 try { 
	await Deno.runTests() 
	Deno.successReport(console.log)
	Deno.failureReport(console.log)
} catch(error) {
	console.error(`Deno.runTests failure`, error)
}






const testConsoliate = () => {
	const pfxs1 = [
		'10.0.0.0/8',
		'10.0.0.0/16',
		'10.0.0.0/24',
		'10.0.1.0/24',
		'10.0.2.0/24',
		'10.0.3.0/24',
		'11.0.0.0/8',
		'11.0.0.0/16',
		'20.0.0.0/24',
		'20.0.1.0/24',
		'20.0.2.0/24',
		'20.0.3.0/24',
		'20.0.4.0/24',
		'20.0.5.0/24',
		'20.0.5.0/32',
		'20.0.5.1/32',
		'20.0.6.0/24',
		'20.0.7.0/24',
		'20.0.8.0/24',
	]

	const pfxs2 = [
		new IPv4('10.0.0.0/8',  '10.0.0.0/8'),
		new IPv4('10.0.0.0/16', '10.0.0.0/16'),
		new IPv4('10.0.0.0/24', '10.0.0.0/24'),
		new IPv4('10.0.1.0/24', '10.0.1.0/24'),
		new IPv4('10.0.2.0/24', '10.0.2.0/24'),
		new IPv4('10.0.3.0/24', '10.0.3.0/24'),
		new IPv4('11.0.0.0/8',  '11.0.0.0/8'),
		new IPv4('11.0.0.0/16', '11.0.0.0/16'),
		new IPv4('20.0.0.0/24', '20.0.0.0/24'),
		new IPv4('20.0.1.0/24', '20.0.1.0/24'),
		new IPv4('20.0.2.0/24', '20.0.2.0/24'),
		new IPv4('20.0.3.0/24', '20.0.3.0/24'),
		new IPv4('20.0.4.0/24', '20.0.4.0/24'),
		new IPv4('20.0.5.0/24', '20.0.5.0/24'),
		new IPv4('20.0.5.0/32', '20.0.5.0/32'),
		new IPv4('20.0.5.1/32', '20.0.5.1/32'),
		new IPv4('20.0.6.0/24', '20.0.6.0/24'),
		new IPv4('20.0.7.0/24', '20.0.7.0/24'),
		new IPv4('20.0.8.0/24', '20.0.8.0/24'),
	]

	const shouldBe = [
		new IPv4(
			'10.0.0.0/7', [
			'10.0.0.0/8',
			'10.0.0.0/16',
			'10.0.0.0/24',
			'10.0.1.0/24',
			'10.0.2.0/24',
			'10.0.3.0/24',
			'11.0.0.0/8',
			'11.0.0.0/16',
		]),
		new IPv4('20.0.0.0/21', [
			'20.0.0.0/24',
			'20.0.1.0/24',
			'20.0.2.0/24',
			'20.0.3.0/24',
			'20.0.4.0/24',
			'20.0.5.0/24',
			'20.0.5.0/32',
			'20.0.5.1/32',
			'20.0.6.0/24',
			'20.0.7.0/24',
		]),
		new IPv4('20.0.8.0/24', [
			'20.0.8.0/24'
		]),
	]

// does not aggregate correctly...check this out (it over-aggregates to a 172.16.0.0/12)
new RoutingTable_v3([
	'172.16.0.0/14',
	'172.20.0.0/23',
	'172.20.7.0/24',
	'172.20.8.0/21',
	'172.20.32.0/19',
	'172.20.64.0/18',
	'172.20.128.0/17',
	'172.21.0.0/16',
	'172.22.0.0/15',
	'172.24.0.0/13'
	]).consolidate().show()

	// this one does (seeminly) properly aggregate - the difference being the 172.20.0.0/22 is removed
	new RoutingTable_v3([
		'172.16.0.0/14',
//		'172.20.0.0/23',
		'172.20.7.0/24',
		'172.20.8.0/21',
		'172.20.32.0/19',
		'172.20.64.0/18',
		'172.20.128.0/17',
		'172.21.0.0/16',
		'172.22.0.0/15',
		'172.24.0.0/13'
		]).consolidate().show()

	//This is the most minimal replication of the over-aggregation issue - this aggregates to 172.16.0.0/12
	new RoutingTable_v3([
		'172.16.0.0/14',
		'172.20.0.0/23',
		'172.24.0.0/13'
	]).consolidate().show({asBinary:true})

			
	
// this produces an errorPrefix
new RoutingTable_v3([
	'172.16.0.0/14',
	'172.20.0.0/23',
	'172.20.6.0/24',
	'172.20.7.0/24',
	'172.20.5.0/24',
  '172.20.2.0/23',
  '172.20.3.0/24',
  '172.20.4.0/24',
  '172.20.16.0/21',
  '172.20.8.0/21',
	'172.20.32.0/19',
	'172.20.64.0/18',
	'172.20.128.0/17',
  '172.20.24.0/21',
	'172.21.0.0/16',
  '172.24.0.0/15',
	'172.22.0.0/15',
	'172.24.0.0/13',
]).consolidate()
.show({asRange:true})
.getUnallocatedBlocksWithin_alt('172.16.0.0/12')
.show({asTrange:true})


new RoutingTable_v3([
	new IPv4('10.0.0.0/23', '10.0.0.0/23'),
	new IPv4('10.0.0.0/24', '10.0.0.0/24'),
	new IPv4('10.0.1.0/24', '10.0.1.0/24'),
	new IPv4('10.0.2.0/23', '10.0.2.0/23'),
	new IPv4('10.0.2.0/24', '10.0.2.0/24'),
	new IPv4('10.0.3.0/24', '10.0.3.0/24'),
	new IPv4('10.0.4.0/23', '10.0.4.0/23'),
	new IPv4('10.0.4.0/24', '10.0.4.0/24'),
	new IPv4('10.0.5.0/24', '10.0.5.0/24'),
	new IPv4('10.0.6.0/23', '10.0.6.0/23'),
])
.consolidate()
.show()


	new RoutingTable_v3([
		'10.0.0.0/22',
		'10.0.4.0/22',
		'10.0.8.0/22',
		'10.0.12.0/22',
	])
	.consolidate()
	.show()
	
	
	
	

	const rt = new RoutingTableNG(pfxs2)
	const crt1 = rt.consolidate_old()
	const crt2 = rt.consolidate_orig_2()

	const rtShouldBe = new RoutingTableNG(shouldBe)
}