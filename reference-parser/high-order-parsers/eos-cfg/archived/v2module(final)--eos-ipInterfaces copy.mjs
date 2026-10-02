import {
	// from Parser_Result_helpers.mjs
	flattenArray,
	joinWith,
	mapArray,
	multiplyBy,
	addTag,
	flattenItemWith,
	flattenItemRecursively,
	flattenItemRecursivelyWith,
	intf_classifyBy,
	normalizedDataSet,
	coroutine,
	nullToObject,
	nullToArray,
	nullToStr,
	groupBy,
	groupByPropName,

	// from Parser_Core.mjs
	seqOf,
	sequenceOf,
	regex,
	oneOf,
	many,
	possibly,
	lookAhead,
	setOf,
	succeedWith,
	everythingUntil,
	except,
	strng,
	many1,

	// from Parser_Text.mjs
	parseLine,
	digits,
	rol,
	hword,
	at_eol,
	word,
	eol,
	_,			// 0 or more consequtive inline whitespace (spaces & tabs)
	__,			// 0 or more consequetive whitespace (spaces, tabs, newlines, carriage returns)

	// from Parser_Network.mjs
	ipAddress,
	ipUC,
	ipMC,
	ipNetwork,
	ipNetwork_asObject,
	interfaceName,
	gotoSection,
	parseSection,
	hostnameFromConfig,
	endOfIndentLevel,
	gotoStr,
	until,
	goto,

	// from classIPv4.mjs
	IPv4,

} from '../parser_modules.mjs'



import {
	eos_cfg_interfaces
} from '../eos-cfg/v2module(final)--eos_cfg_interfaces.mjs'



const ipInterfaces = (switchName) => coroutine( function*() {

	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'ipInterfaces',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									  // future capability
		usage: '',							  	// future capability to provide help (may not be used)
	}


	const {
		result:interfaces=[], 
		dataLog:interfaces_dataLog=[]
	}	= yield possibly(lookAhead(get_eoscfg_interfaces(switchName).dataLog_toResult())).map(nullToObject)


	// helper function - eliminate columns not needed for ip-interfaces w/regards to bgp peering, & re-order the rest
	const formatColumns = ({
		interfaceName,
		ip_addr,
		ip_masklen,
		cfgState,
		vrf = 'default',
		ipType,
		type,
		portMode,
		desc,
		ip_has_nat_cfg,
		ip_has_igmpStaticGrp_cfg,
		ip_acl_in,
		ip_acl_out,
		ip_mc_acl_out,
		ip_mc_acl,
		ip_pim_sparsemode,
		ip_pim_border,
		ip_pim_dr_priority,
		ip_pim_bsr_border,
		varp_IP,
		ip_has_dhcp_helper_cfg,
		dot1q,
		speed,
		vrrp_priority,
		vrrp,
		switchPortMode,
	}) => ({
		_key_					: `${switchName}:${vrf==''?'default': vrf}:${ip_addr}`,						// used to help match peer IPs on other switches (bgp, mlag, etc)
		interfaceName,
		ip_addr,
		ip_masklen,
		ip_subnet			:	IPv4.of(`${ip_addr}/${ip_masklen}`)?.getNetwork()?.toString() ?? console.warn(`${switchName}: [formatColumns]: invalid_ip_address on interface ${name}`, ip_addr) ?? `255.255.255.255`,
		cfgState,
		vrf,
		desc,
		ipType,
		type,
		portMode,
		ip_has_nat_cfg,
		ip_has_igmpStaticGrp_cfg,
		ip_acl_in,
		ip_acl_out,
		ip_mc_acl_out,
		ip_mc_acl,
		ip_pim_sparsemode,
		ip_pim_border,
		ip_pim_dr_priority,
		ip_pim_bsr_border,
		varp_IP,
		ip_has_dhcp_helper_cfg,
		dot1q,
		speed,
		vrrp_priority,
		vrrp,
		switchPortMode,
	})


	// ip interfaces here are defined as any having an IP address (i.e. non-empty ipType)
	const ipInterfaces = interfaces
		.filter( (intf) => intf.ipType !== '')
		.map(formatColumns)



	/****************************************
   * Section 3 - bgpPeer local processing 
   *  - augments bgpPeers with local interface information, based on a lookup of the peer IP, and mapping
   *		the peer IP to a local interface
   * Note: Does not yet handle VRFs, where IP addresses may duplicate on same devices
   ***************************************/
  
	// converts "|" in strings to a newline & indent
	const makePretty = (descriptionString) => descriptionString.replaceAll('|','\n  ')
  
	// create a lookup cache for this switch's ip interface records by name
	const ipInterfaces_lookup_byName = groupByPropName ('interfaceName') (ipInterfaces)
  
	// create a RoutingTable object of this switch's ipInterface routes, so we can resolve bgpPeer IPs to local interface names by doing
	//	a route lookup (i.e. if bgpPeer IP is a subnet of the routing table, get the matchign routing table's data entry (containing the interface name)
	//	then use the name to look up the ipInterface record.
	const ipInterfaces_asLookup = ipInterfaces.map( ({ip_addr, ip_masklen, interfaceName, vrf}) => new IPv4(`${ip_addr}/${ip_masklen}`)?.getNetwork()?.setData({interfaceName, vrf}) ) ?? `[ipInterfaces_asLookup]:invalid_ip_address on interface ${interfaceName}`

	//	console.log({ipInterfaces_asLookup, ipInterfaces, interfaces_dataLog})

	return ipInterfaces

})


// ipInterfaces('myswitch')


export {
	ipInterfaces,
}