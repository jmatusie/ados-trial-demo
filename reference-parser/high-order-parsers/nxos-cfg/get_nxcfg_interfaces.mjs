/**  Comment out this import and export at bottom when using in browser sandbox     */
import {
	// from Parser_Result_helpers.mjs
	flattenArray,
	joinWith,
	mapArray,
	multiplyBy,
	addTag,
	flattenItemWith,
	flattenItem,
	flattenItemRecursively,
	flattenItemRecursivelyWith,
	intf_classifyBy,
	normalizedDataSet,
	is,

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
} from '../parser_modules.mjs'



/*********************************************************************************
 * Module:      get_nxcfg_interfaces
 * Version:     3.0
 * Parameters:  deviceName: string
 * Description: Parses all BGP content for a single NXOS device
 * Caveats:     ?
 * Output:      normalized dictionary: 
 * {
 * 	"interface-name",		//	interface name
 * 	"description", 			//	inerface description
 * 	"noSwitchPortCmd"?  //	flagged if defined in config,
 * 	"ipAddr",    				//	ip address and mask,
 * 	"ipPimSparseMode",  //	flag,
 * 	"ipAclIn",   				//	name of security ACL (inbound)
 * 	"ipMcAcl",   				//	name of multicast boundary ACL (outbound) 
 * 	"nativeVlan",   		//	native VLAN (if defined in config)
 * 	"allowedVlans",   	//	allowed VLANs (if defined in config)
 * 	"switchPortMode",  	//	flag if defined in config
 * 	"portChannel",  		//	flag if defined in config
 * 	"shutdown",    			//	flag if defined in config
 * 	"vrrpAddr",    			//	virtual router address
 * }
 *
 */
/*********************************************************************************
 * Module:      get_nxcfg_interfaces
 * Version:     3.0
 * Parameters:  deviceName: string
 * Description: Parses all BGP content for a single NXOS device
 * Caveats:     ?
 * Output:      normalized dictionary: 
 * {
 * 	"interface-name",		//	interface name
 * 	"description", 			//	inerface description
 * 	"noSwitchPortCmd"?  //	flagged if defined in config,
 * 	"ipAddr",    				//	ip address and mask,
 * 	"ipPimSparseMode",  //	flag,
 * 	"ipAclIn",   				//	name of security ACL (inbound)
 * 	"ipMcAcl",   				//	name of multicast boundary ACL (outbound) 
 * 	"nativeVlan",   		//	native VLAN (if defined in config)
 * 	"allowedVlans",   	//	allowed VLANs (if defined in config)
 * 	"switchPortMode",  	//	flag if defined in config
 * 	"portChannel",  		//	flag if defined in config
 * 	"shutdown",    			//	flag if defined in config
 * 	"vrrpAddr",    			//	virtual router address
 * }
 *
 */
const get_nxcfg_interfaces = (deviceName) => {
	const pmodule = {
		name: 'get_nxcfg_interfaces',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									  // future capability
		usage: '',							  	// future capability to provide help (may not be used)
	}
	
	const isTrue = (result) => true  // tags the existence of a result as 'true' - for flags (i.e. if xyz is parsed, xyz is true)

	// raw line parsers
	const interfaceHeader_KNOWN = parseLine('interface', interfaceName).map((result)=>result[1])
	const interfaceHeader_UNK = parseLine('interface', rol).map((result) => result[1])

	// general params:
	const desc						= parseLine('description', rol ).map((result)=>result[1])
	const ipAddr_wMask 		= parseLine('ip address', ipAddress.tag('ip_addr'), '/', digits.tag('ip_masklen'))
	//const ipAddr_wMask					= parseLine('ip address', ipAddress, '/', digits).map( ([, ip_addr, , ip_masklen]) => ({ip_addr, ip_masklen}) )
	const ipUnnumbered 		= parseLine('ip address unnumbered', interfaceName).map((result) => result[1])
	const shutdn 					= parseLine('shutdown').map(isTrue)
	const noshutdn 				= parseLine('no shutdown').map(isTrue)
	const vrf							=	parseLine('vrf member', hword).map((result)=>result[1])
	const encapsDot1q			= parseLine('encapsulation dot1q', digits).map((result)=>result[1])
	const ipAclIn					= parseLine('ip access-group', hword, 'in').map((result)=>result[1])
	const ipAclout				= parseLine('ip access-group', hword, 'out').map((result)=>result[1])


	// L2 common & important configs:
	const switchPort									= parseLine('switchport', eol).map(isTrue)
	const noSwitchPort								= parseLine('no switchport').map(isTrue)
	const switchportMode							= parseLine('switchport mode', word).map((result)=>result[1])
	const switchPortAccessVlan				= parseLine('switchport access vlan', digits).map((result)=>result[1])
	const switchPortTrunkNativeVlan		= parseLine('switchport trunk native vlan', digits).map((result)=>result[1])
	const switchPortTrunkAllowedVlans	=	parseLine('switchport trunk allowed vlan', rol).map((result)=>result[1].split(',').join('|'))
	const switchPortAccessOther				= parseLine('switchport access', rol).map((result)=>result[1])
	const switchPortTrunkOther					= parseLine('switchport trunk', rol).map((result)=>result[1])
	
	// MCAST / PIM / IGMP
	const ipMcastBoundaryOut	= parseLine('ip multicast boundary', hword, 'out').map((result)=>result[1])
	const ipMcastBoundaryIn		= parseLine('ip multicast boundary', hword).map((result)=>result[1])
	const ipPimSparseMode			= parseLine('ip pim sparse-mode').map(isTrue)
	const ipPimDrPriority			= parseLine('ip pim dr-priority', digits).map((result)=>result[1])
	const ipPimNeighborFilter	= parseLine('ip pim neighbor-policy', hword).map((result)=>result[1])
	const ipPimJPPolicy 			= parseLine('ip pim jp-policy', hword).map(res=>res[1])
	const ipPimBsrBorder			= parseLine('ip pim bsr-border').map(isTrue)
	const ipIgmpVersion				= parseLine('ip igmp version', digits).map((result)=>result[1])

	// Flag only (for further config fetching)
	const hasIgmpStaticGroupConfig 	= parseLine('ip igmp static-group').map(isTrue)
	const hasIgmpStaticOIFConfig 		= parseLine('ip igmp static-oif').map( isTrue)
	const hasNatConfig	 						= parseLine('ip nat').map(isTrue)
	const hasIPHelperAddress 				= parseLine('ip helper-address', ipAddress).map(isTrue)

	// spanning-tree:
	const stpPortfast 		= parseLine('spanning-tree portfast').map(isTrue)
	const sptBpduFilter 	= parseLine('spanning-tree bpdufilter', hword).map((result)=>result[1])
	const stpBpduGuard		= parseLine('spanning-tree', 'bpduguard', 'enable').map(isTrue)
	const channelGroup		= parseLine('channel-group', digits).map((result)=>result[1])

	// ptp items:
	const ptpEnable				=	parseLine('ptp').map(isTrue)
	const ptpRole					= parseLine('ptp role', hword).map((result)=>result[1])
	const ptpDelayMech		= parseLine('ptp delay-mechanism', hword).map((result)=>result[1])
	const ptpDelayReqIntvl= parseLine('ptp delay-request minimum interval', hword).map((result)=>result[1])
	const ptpSyncInterval	= parseLine('ptp sync interval', hword).map((result) => result[1])
	const ptpVlan					= parseLine('ptp vlan', digits).map((result)=>result[1])
	const ptpOther					=	parseLine('ptp', rol).map(isTrue)

	// lldp items:
	const lldpDisabled		= parseLine('lldp disabled').map(isTrue)
	const lldpNoTx				= parseLine('no lldp transmit').map(isTrue)
	const lldpOther				=	parseLine('lldp', rol).map(isTrue)

	// miscellaneous items:
	const flowControl			=	parseLine('flowcontrol', rol).map((result)=>null)
	const speed						= parseLine('speed', rol).map((result)=>result[1])
	const bfd							= parseLine('bfd', rol ).map((result)=>result[1])
	const noAutostate 		= parseLine('no autostate').map((result) => true)
	const loadInterval		=	parseLine('load-interval', digits).map((result)=>result[1])
	const mtu 						= parseLine('mtu', digits).map((result) => result[1])
	const ipMtu 					= parseLine('ip mtu', digits).map((result) => result[1])
	//const vlanID					= parseLine('vlan id', digits).map((result)=>result[1])

	// wildcard line-items
	const unparsed				= parseLine(rol).map((result)=>result[0]).named('unparsed')


	/** HSRP Section (START) */
	// hsrp lines have more structure
	const hsrpHeader 		= parseLine( 'hsrp', digits).map((result)=>result[1])
	const hsrpPreempt 	= parseLine( 'preempt').map( isTrue )
	const hsrpPriority 	= parseLine( 'priority', digits).map((result)=>result[1])
	const hsrpIp 				= parseLine( 'ip', ipAddress).map((result)=>result[1])

	// hsrp has more sub-structure, so parse it here
	const hsrpConfigLine = oneOf(
		hsrpPreempt.tag('hsrp_preempt'),
		hsrpPriority.tag('hsrp_priority'),
		hsrpIp.tag('hsrp_ip'),
	).named('oneOf(hsrpConfigLines')
	
	const hsrpRecord = sequenceOf(
		hsrpHeader.tag('hsrp_id'),
		until(endOfIndentLevel, sequenceOf(
			many(hsrpConfigLine)
		))
	)
	/** HSRP Section (END) */


	/** VRRP Section (START) */
	// hsrp lines have more structure
	const vrrpHeader 		= parseLine( 'vrrp', digits).map((result)=>result[1])
	const vrrpPreempt 	= parseLine( 'preempt').map( isTrue )
	const vrrpPriority 	= parseLine( 'priority', digits).map((result)=>result[1])
	const vrrpIp 				= parseLine( 'ip', ipAddress).map((result)=>result[1])

	// FHRP items:
	// const varpIP					= parseLine('ip virtual-router address', ipAddress).map((result)=>result[1])

	// vrrp has more sub-structure, so parse it here
	const vrrpConfigLine = oneOf(
		vrrpPreempt.tag('vrrp_preempt'),
		vrrpPriority.tag('vrrp_priority'),
		vrrpIp.tag('vrrp_ip'),
	).named('oneOf(vrrpConfigLines')
	
	const vrrpRecord = sequenceOf(
		vrrpHeader.tag('vrrp_id'),
		until(endOfIndentLevel, sequenceOf(
			many(vrrpConfigLine)
		))
	)
	/** VRRP Section (END) */

	

	// any matches to these parsers are thrown out
	const ignored = [
		parseLine('switchport tool group', rol),	//.logResult( ([part1,part2])=>`[${pmodule.name}]: intentionally ignoreed text '${part1} ${part2}'`),
	]

	const interfaceConfigLine =	oneOf(
		// general / common params:
		desc.tag('desc'),
		ipAddr_wMask.tag('ip_addr'),	
		ipUnnumbered.tag('ip_unnumbered'),
		shutdn.tag('has_shutdown'),
		noshutdn.tag('has_noshutdown'),
		vrf.tag('vrf'),
		encapsDot1q.tag('dot1q'),
		ipAclIn.tag('ip_acl_in'),
		ipAclout.tag('ip_acl_out'),

		// L2 common & important configs:
		switchPort.tag('explicit_switchport').addTag('is_switchport', true),
		noSwitchPort.tag('explicit_no_switchport'),
		switchportMode.tag('l2_mode'),
		switchPortAccessVlan.tag('l2_access_vlan'),
		switchPortTrunkNativeVlan.tag('l2_native_vlan'),
		switchPortTrunkAllowedVlans.tag('l2_allowed_vlan'),
		switchPortAccessOther.tag('l2_access_UNK'),
		switchPortTrunkOther.tag('l2_trunk_UNK'),

		// MCAST / PIM / IGMP
		ipMcastBoundaryOut.tag('ip_mc_acl_out'), 
		ipMcastBoundaryIn.tag('ip_mc_acl'), 
		ipPimSparseMode.tag('ip_pim_sparsemode'),
		ipPimDrPriority.tag('ip_pim_dr_priority'),
		ipPimNeighborFilter.tag('ip_pim_neighbor_filter'),
		ipPimJPPolicy.tag('ip_pim_jppolicy'),
		ipPimBsrBorder.tag('ip_pim_bsr_border'),
		ipIgmpVersion.tag('igmp_version'),

		// Flag only (for further config fetching)
		hasIgmpStaticGroupConfig.tag('hascfg_igmp_static'),
		hasIgmpStaticOIFConfig.tag('hascfg_igmp_static'),
		hasNatConfig.tag('hascfg_nat'),
		hasIPHelperAddress.tag('hascfg_dhcp_proxy'),

		// spanning-tree:
		stpPortfast.tag('stp_portfast'),
		sptBpduFilter.tag('stp_bpdufilter'),
		stpBpduGuard.tag('stp_bpduguard'),
		channelGroup.tag('channel_group'),

		// ptp
		ptpEnable.tag('ptp_enabled'),
		ptpRole.tag('ptp_role'),
		ptpDelayReqIntvl.tag('ptp_delay_req_interval'),
		ptpDelayMech.tag('ptp_delay_mech'),
		ptpSyncInterval.tag('ptp_sync_interval'),
		ptpVlan.tag('ptp_vlan'),
		ptpOther.tag('ptp_UNK'),

		// lldp items:
		lldpDisabled.tag('lldp_disabled'),
		lldpNoTx.tag('lldp_no_tx'),
		lldpOther.tag('lldp_UNK'),

		// miscellaneous items:
		flowControl.tag('hascfg_flowcontrol'),
		speed.tag('speed'),
		bfd.tag('bfd_cfg'),
		noAutostate.tag('no_autostate'),
		loadInterval.tag('load_interval'),
		mtu.tag('mtu'),
		ipMtu.tag('ip_mtu'),
		//vlanId.tag('vlan_id'),

		// 	In NX-OS, the FHRP config has nested structure, so these are not simple line-levels as abive
		hsrpRecord,
		vrrpRecord,

		// parse & discard (i.e. dont' tag) those in the 'ignored' list
		...ignored,

		// any lines not captured by above parsers are tagged and logged
		unparsed.logResult((res) => `${deviceName}: [${pmodule.name}::interfaceConfigLine]: Unrecognized text parsing interface configuration: '${res}')`).tag('UNK_nxos_cfg_interface'),
	).named('oneOf(interfaceConfigLines')


	// whether we are already aware of the interfacename or not, we're including it.
	const interfaceHeader = oneOf(
		interfaceHeader_KNOWN,
		interfaceHeader_UNK.logResult((res) => `${deviceName}: [${pmodule.name}::interfaceHeader] Unrecognized interface type '${res}'`)
	)


	const parseInterface = sequenceOf(
		interfaceHeader.tag('interfaceName'),
		many(interfaceConfigLine)
	).named('parseInterface')
	
	
	// example of record parser using indentation levels to terminate the record
	const interfaceRecord = seqOf(
		gotoStr('\ninterface'),										  // fixes cursor to start of interface, accounting for the newline preceding it.  Somewhat hacky, but works in NX-OS
		gotoStr('interface'),
		until(endOfIndentLevel, parseInterface)			// runs the actual indent parser and returns results of parseInterface
	)
	
	
	const classifyIntfType = ({ interfaceName, ...rest }) => ({
		interfaceName,
		...rest,
		type: (interfaceName == null) ? `nullInterfaceName(${interfaceName})`
			: interfaceName.split('.').length > 1 ? 'subint'
			: /mgmt/i.test(interfaceName) ? 'management'
			: /channel/i.test(interfaceName) ? 'ethernet-channel'
			: /ethernet/i.test(interfaceName) ? 'ethernet'
			: /loopback/i.test(interfaceName) ? 'loopback'
			: /vlan/i.test(interfaceName) ? 'svi'
			: /vxlan/i.test(interfaceName) ? 'vxlan'
			: /tunnel/i.test(interfaceName) ? 'tunnel'
			: 'unclassified',
	})


	const formatColumns = ({
		// common & important configs
		interfaceName,
		type,											// added by function 'classifyInteraceType'
		desc,
		ip_addr,
		ip_masklen,
		ip_unnumbered,
		has_shutdown = false,			// default in EOS if not configured on interface
		has_noshutdown,
		vrf,
		dot1q,
		ip_acl_in,
		ip_acl_out,

		// L2 common & important configs:
		explicit_switchport,
		explicit_no_switchport,
		is_switchport,
		l2_mode,
		l2_access_vlan,
		l2_native_vlan,
		trunk_group,
		l2_allowed_vlan,
		l2_access_UNK,
		l2_trunk_UNK,

		// MCAST / PIM / IGMP
		ip_mc_acl,
		ip_mc_acl_out,
		ip_pim_sparsemode,
		ip_pim_dr_priority,
		ip_pim_neighbor_filter,
		ip_pim_border,
		ip_pim_bsr_border,
		igmp_version,

		// Flag only (for further config fetching)
		hascfg_igmp_static,
		hascfg_igmp_host_proxy,
		hascfg_nat,
		hascfg_dhcp_client,
		hascfg_dhcp_server,
		hascfg_dhcp_proxy,
		hascfg_evpn,
		hascfg_vxlan,
		hascfg_te,
		hascfg_tunnel,
		hascfg_ospf,
		hascfg_mpls,
		hascfg_sr,
		hascfg_isis,

		// FHRP items:
		vrrp_ip,
		vrrp_id,
		vrrp_priority,
		hsrp_ip,
		hsrp_id,
		hsrp_priority,
		hsrp_preempt,
		
		// spanning-tree:
		stp_portfast,
		stp_bpdufilter,
		stp_bpduguard,
		channel_group,

		// ptp
		ptp_enabled,
		ptp_role,
		ptp_delay_mech,
		ptp_delay_req_interval,
		ptp_sync_interval,
		ptp_vlan,
		ptp_UNK,

		// lldp
		lldp_disabled,
		lldp_no_tx,
		lldp_no_rx,
		lldp_UNK,

		// miscellaneous items
		hascfg_flowcontrol,
		speed,
		bfd_cfg,
		no_autostate,
		load_interval,
		mtu,
		has_svc_policy_cfg,

		// believed to be EOS only
		// has_shaping_cfg,
		// vlan_id,
		// queue_monitor,
		// mlag_id,
		// UNK_eosos_cfg_interface,

		// believed to be NX-OS only
		ip_pim_jppolicy,
		UNK_nxos_cfg_interface,

		...skipped
	}) => ({
		deviceName,
		interfaceName,
		ip_addr,
		ip_masklen,
		vrf,
		type,
		admin_down: (has_shutdown) ? true : (has_noshutdown) ? false : false,

		ip_type: is.empty(ip_addr) ? ''
			: parseInt(ip_masklen) == 32 ? 'loopback'
				: parseInt(ip_masklen) >= 30 ? 'transit'
					: parseInt(ip_masklen) >= 29 ? 'hybrid'
						: 'access',
	
		port_mode: (type == 'loopback') ? ''
			: explicit_no_switchport ? 'L3'
				: type == 'subint' ? 'L3'
					: type == 'svi' ? 'L3'
						: 'L2',
	
		desc,
		hascfg_nat,
		hascfg_igmp_static,
		igmp_version,
		ip_acl_in,
		ip_acl_out,
		ip_mc_acl_out,
		ip_mc_acl,
		ip_pim_sparsemode,
		ip_pim_border,
		ip_pim_dr_priority,
		ip_pim_bsr_border,
		ip_pim_neighbor_filter,
		ip_pim_jppolicy,

		// PTP
		ptp_enabled,
		ptp_delay_req_interval,
		ptp_delay_mech,
		ptp_role,
		ptp_vlan,

		// FHRP items
		vrrp_ip,
		vrrp_id,		
		vrrp_priority,
		hsrp_ip,
		hsrp_id,
		hsrp_priority,
		hsrp_preempt,

		hascfg_flowcontrol,
		lldp_no_tx,
		load_interval,
		hascfg_dhcp_proxy,
		hascfg_dhcp_client,
		hascfg_dhcp_server,

		dot1q,
		speed,
		bfd_cfg,
		l2_mode,
		l2_native_vlan,
		l2_access_vlan,
		l2_allowed_vlan,
		l2_trunk_UNK,
		l2_access_UNK,

		channel_group,
		UNK_nxos_cfg_interface,
		_key_: `${deviceName}:${interfaceName}`,
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')}`
	})
	

	// NOTE: the double-wrapping of seqOf is necessary because we have to run .multiplyBy() after
	// the getTaggedR().  It's just a corner-case when we're done with all the processsing and need to 
	// return the parsre.  We may be able to fix this but it's not important right now.
	
	return seqOf(
		seqOf(
			many(interfaceRecord).tagList('intfs')
		).getTaggedR()
		.map(multiplyBy('intfs'))
	)
	.map(flattenArray)													// this fixes our double seqOf...
	.map(mapArray(flattenItem))				// this fixes the fact that the IP parser returns an object under the interface
	.map(mapArray(classifyIntfType))
	.map(mapArray(formatColumns))
}

export { get_nxcfg_interfaces }

	
	// end of module eos_cfg_interfaces
		
	