import { parseLine } from "../parser_modules.mjs"

/****************************************************************************
* module: 			eos_cfg_interfaces (v2 output)
*	description:	parses the output of a single Arista switches BGP section (specifically the peers)
*	output:				table containing the following:
*
*				interface   				interface name
*				desc    						inerface description
*				noSwitchPortCmd?    flagged if defined in config,
*				ipAddr    					ip address and mask,
*				ipPimSparseMode    	flag,
*				ipAclIn   				 	name of security ACL (inbound)
*				ipMcAcl   				 	name of multicast boundary ACL (outbound) 
*				nativeVlan   			 	native VLAN (if defined in config)
*				allowedVlans   		 	allowed VLANs (if defined in config)
*				switchPortMode  	 	flag if defined in config
*				portChannel  		  	flag if defined in config
*				shutdown    				flag if defined in config
*				vrrpAddr    				virtual router address
*
*/
const eos_cfg_interfaces = (deviceName) => {

	// raw line parsers
	const eosCommentLine1  = parseLine('#', any)
	const eosCommentLine2  = parseLine(_, '!', any)
	const interfaceHeader = parseLine('interface', interfaceName).map((result)=>result[1])
	const desc						= parseLine('description', rol ).map((result)=>result[1])
	const ipAddr					= parseLine('ip address', ipAddress, '/', digits).map( ([, ip_addr, , ip_masklen])=>({ip_addr, ip_masklen}) )
	const ipAddr2					= parseLine('ip address', ipNetwork).map((result)=> {
		const [ipaddr, ipMaskLen] = result[1].split('/')
		const returnVal = result[1]
		return ipMaskLen
	})
	const shutdn 					= parseLine('shutdown').map((result)=>true)
	const noshutdn 				= parseLine('no shutdown').map((result)=>true)
	const channelMember		= parseLine('channel-group', digits).map((result)=>result[1])
		
	const switchPort			= parseLine('switchport', eol).map((result)=>true)
	const noSwitchPort		= parseLine('no switchport').map((result)=>true)
	const switchPortMode	= parseLine('switchport mode', word).map((result)=>result[1])
	const switchPortTrunk	= parseLine('switchport trunk', rol).map((result)=>result[1])
	const switchPortAccess= parseLine('switchport access', rol).map((result)=>result[1])
	const nativeVlan			= parseLine('switchport trunk native vlan', digits).map((result)=>result[1])
	const allowedVlans		=	parseLine('switchport trunk allowed vlan', rol).map((result)=>result[1].split(',').join('|'))
	const accessVlan			= parseLine('switchport access vlan', digits).map((result)=>result[1])
			
	const stp_bpdufilter 	= parseLine('spanning-tree bpdufilter', hword).map((result)=>result[1])
	const stp_portfast 		= parseLine('spanning-tree portfast').map((result)=>true)
	const stp_bpduguard		= parseLine('spanning-tree', 'bpduguard', 'enable').map((result)=>true)
		
	const vrf							=	parseLine('vrf', hword).map((result)=>result[1])
	const vrf_2						=	parseLine('vrf forwarding', hword).map((result)=>result[1])
	const dot1q						= parseLine('encapsulation dot1q vlan', digits).map((result)=>result[1])
	const ipAclIn					= parseLine('ip access-group', hword, 'in').map((result)=>result[1])
	const ipAclout				= parseLine('ip access-group', hword, 'out').map((result)=>result[1])
		
	const ipMcAcl_out			= parseLine('ip multicast boundary', hword, 'out').map((result)=>result[1])
	const ipMcAcl_out_2		= parseLine('multicast ipv4 boundary', hword, 'out').map((result)=>result[1])
	const ipMcAcl					= parseLine('ip multicast boundary', hword).map((result)=>result[1])
	const ipMcAcl_2				= parseLine('multicast ipv4 boundary', hword).map((result)=>result[1])
	const ipPimSparseMode	= parseLine('ip pim sparse-mode').map((result)=>true)
	const ipPimSparseMode_2=parseLine('pim ipv4 sparse-mode').map((result)=>true)
	const ipPimBorder			= parseLine('pim ipv4 border-router').map((result)=>true)
	const ipPimBorder_2		= parseLine('pim ipv4 border').map((result)=>true)
	const ipPimBsrBorder	= parseLine('ip pim bsr-border').map((result)=>true)
	const ipPimBsrBorder_2= parseLine('pim bsr ipv4 border').map((result)=>true)
	const ipPimDrPriority	= parseLine('pim ipv4 dr-priority', digits).map((result)=>result[1])
		
	// these return true/false beacause there could be multiple lines with 
	// these commands, which should be handled by a specialized parser
	const has_igmpStaticGrp = parseLine('ip igmp static-group').map((result)=>true)
	const has_igmpv2 				= parseLine('ip igmp version 2').map((result)=>true)
	const has_nat	 				  = parseLine('ip nat', rol).map((result)=>true)
	const has_helperAddress = parseLine('ip helper-address', ipAddress).map((result)=>true)
		
	const varpIP					= parseLine('ip virtual-router address', ipAddress).map((result)=>result[1])
	const vrrpIP					= parseLine('vrrp', digits, 'ipv4', ipAddress).map( ([, grp, , addr])  => `group:${grp},addr:${addr})` )
	const vrrpPriority		= parseLine('vrrp', digits, 'priority-level', digits).map( ([, grp, , pri ])  => `group:${grp},priority:${pri})` )
		
	const loadInterval		=	parseLine('load-interval', digits).map((result)=>result[1])
	const mlagID					= parseLine('mlag', digits).map((result)=>result[1])
	const vlanID					= parseLine('vlan id', digits).map((result)=>result[1])
	const ptpEnable				=	parseLine('ptp enable').map((result)=>true)
	const ptpRole					= parseLine('ptp role', hword).map((result)=>result[1])
	const ptpDelayMech		= parseLine('ptp delay-mechanism', hword).map((result)=>result[1])
	const ptpVlan					= parseLine('ptp vlan', digits).map((result)=>result[1])
	const flowControlRec	=	parseLine('flowcontrol', rol).map((result)=>null)
	const remaining				= parseLine(rol).map((result)=>null)
	const lldp_disabled		= parseLine('lldp disabled').map((result)=>true)
	const lldp_noTransmit	= parseLine('no lldp transmit').map((result)=>true)
	const speed						= parseLine('speed', rol).map((result)=>result[1])
	const queueMonitor		= parseLine('queue-monitor length thresholds', digits, digits).map( ([,,low,high])=>`${low},${high}`)
	const bfd							= parseLine('bfd', rol ).map((result)=>result[1])
	const mlag						= parseLine('mlag', digits).map((result)=>result[1])
	const traffic_shaping	= parseLine('shape rate', digits).map((result)=>result[1])
	const everythingElse				= parseLine(rol).map((result)=>result[0]).named('everythingElse')
	
	
	const interfaceConfigLine =	oneOf(
		// general params (used by classifiers)
		desc.tag('desc'),
		ipAddr.tagAs('ip'),	
		shutdn.tagAs('is_shutdown'),
		noshutdn.tagAs('explicit_noshutdown'),
		switchPort.tagAs('explicit_switchPort').addTag('switchPort', true),
		noSwitchPort.tagAs('explicit_noswitchPort'),
		channelMember.tagAs('channelMember'),
		
		// layer 3 params
		ipAclIn.tagAs('ip_acl_in'),
		ipAclout.tagAs('ip_acl_out'),
		ipMcAcl_out.tagAs('ip_mc_acl_out'), 
		ipMcAcl_out_2.tagAs('ip_mc_acl_out'), 
		ipMcAcl.tagAs('ip_mc_acl'), 
		ipMcAcl_2.tagAs('ip_mc_acl'),
		ipPimSparseMode.tagAs('ip_pim_sparsemode'),
		ipPimSparseMode_2.tagAs('ip_pim_sparsemode'),
		ipPimBorder.tagAs('ip_pim_border'),
		ipPimBorder_2.tagAs('ip_pim_border'),
		ipPimBsrBorder.tagAs('ip_pim_bsr_border'),
		ipPimBsrBorder_2.tagAs('ip_pim_bsr_border'),
		ipPimDrPriority.tagAs('ip_pim_dr_priority'),
		varpIP.tagAs('varp_IP'),
		vrrpIP.tagAs('vrrp'),
		vrrpPriority.tagAs('vrrp_priority'),
		vrf.tagAs('vrf'),
		vrf_2.tagAs('vrf'),
		
		// layer 2 
		switchPortTrunk.tagAs('l2_trunk'),
		switchPortAccess.tagAs('l2_access'),
		switchPortMode.tagAs('switchPortMode'),
		nativeVlan.tagAs('nativeVlan'),		
		accessVlan.tagAs('accessVlan'),
		allowedVlans.tagAs('allowedVlans'),
		dot1q.tagAs('dot1q'),
		loadInterval.tagAs('loadInterval'),
		lldp_disabled.tagAs('lldpDisabled'),
		lldp_noTransmit.tagAs('lldpNoTx'),
		mlag.tagAs('mlag'),
		vlanID.tagAs('vlanID'),
		
		// spanning-tree
		stp_portfast.tagAs('stp_portfast'),
		stp_bpdufilter.tagAs('stp_bpdufilter'),
		stp_bpduguard.tagAs('stp_bpduguard'),
		
		// layer 1~ish
		speed.tagAs('speed'),
		queueMonitor.tagAs('queueMonitor'),
		bfd.tagAs('bfdCfg'),
		vlanID.tagAs('vlanID'),
		flowControlRec.tagAs('flowControlRec'),
		
		// ptp
		ptpEnable.tagAs('ptpEnable'),
		ptpRole.tagAs('ptpRole'),
		ptpDelayMech.tagAs('ptpDelayMechanism'),
		ptpVlan.tagAs('ptpVlan'),
		
		// boolean values, because these commands may be multiple per interface, so separate parser is warranted
		has_nat.tagAs('ip_has_nat_cfg'),
		has_helperAddress.tagAs('ip_has_dhcp_helper_cfg'),
		has_igmpStaticGrp.tagAs('ip_has_igmpStaticGrp_cfg'),
		has_igmpv2.tagAs('ip_has_igmpv2'),
		eosCommentLine1.tagAs('eos1'),
		eosCommentLine2.tagAs('eos2'),
		// any lines not captured by abobe parsers are tagged and logged
	
		everythingElse.logResult('UNK_eos_cfg_interface').tagAs('UNK_eos_cfg_interface'),
	).named('oneOf(interfaceConfigLines')
	
		
	// re-usable component that can plug into interface record parsers.
	// results in a single interface record object.
	const parseInterface = sequenceOf(
		interfaceHeader.tagAs('name'),
		many(interfaceConfigLine),
	).named('parseInterface')
	
	
	// example of record parser using indentation levels to terminate the record
	const interfaceRecord = seqOf(
		until(endOfIndentLevel, parseInterface),
		parseLine('!'),					// <-- note that there is a '!' on a line by itself after we return to the same indentation level.  We need to explicitly consume it
	).getTaggedR()
	
	
	
	return sequenceOf(
		gotoSection('interface'),
		many(interfaceRecord).tagList('interfaces'),
	).getTaggedR()
		.map(multiplyBy('interfaces'))
		.map(mapArray(flattenItem))
		.map(mapArray(intf_classifyBy.cfgState))
		.map(mapArray(intf_classifyBy.hwType))
		.map(mapArray(intf_classifyBy.portMode))
		.map(mapArray(intf_classifyBy.ipType))
		.map(normalizedDataSet)
	//	.dataLog_toResult()
	}
	
	
	
	eos_cfg_interfaces('junk')
	
	// end of module eos_cfg_interfaces
		
	