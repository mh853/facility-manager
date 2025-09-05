import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  try {
    console.log('🔧 Converting boolean fields to integer...');
    
    // First, check current data types
    const { data: currentData } = await supabaseAdmin
      .from('business_info')
      .select('id, vpn_wired, vpn_wireless, multiple_stack')
      .limit(5);
    
    console.log('Current boolean values sample:', currentData);
    
    // Convert boolean fields to integers one by one
    console.log('🔄 Converting vpn_wired field...');
    
    // Update vpn_wired: false -> 0
    const { error: vpnWiredFalseError } = await supabaseAdmin
      .from('business_info')
      .update({ vpn_wired: 0 })
      .eq('vpn_wired', false);
    
    // Update vpn_wired: true -> 1
    const { error: vpnWiredTrueError } = await supabaseAdmin
      .from('business_info')
      .update({ vpn_wired: 1 })
      .eq('vpn_wired', true);

    console.log('🔄 Converting vpn_wireless field...');
    
    // Update vpn_wireless: false -> 0
    const { error: vpnWirelessFalseError } = await supabaseAdmin
      .from('business_info')
      .update({ vpn_wireless: 0 })
      .eq('vpn_wireless', false);
    
    // Update vpn_wireless: true -> 1
    const { error: vpnWirelessTrueError } = await supabaseAdmin
      .from('business_info')
      .update({ vpn_wireless: 1 })
      .eq('vpn_wireless', true);

    console.log('🔄 Converting multiple_stack field...');
    
    // Update multiple_stack: false -> 0
    const { error: multipleStackFalseError } = await supabaseAdmin
      .from('business_info')
      .update({ multiple_stack: 0 })
      .eq('multiple_stack', false);
    
    // Update multiple_stack: true -> 1
    const { error: multipleStackTrueError } = await supabaseAdmin
      .from('business_info')
      .update({ multiple_stack: 1 })
      .eq('multiple_stack', true);
    
    console.log('Boolean to integer conversion completed');
    
    return NextResponse.json({
      success: true,
      message: 'Boolean fields converted to integer successfully',
      conversions: {
        vpn_wired: vpnWiredFalseError || vpnWiredTrueError ? 'failed' : 'success',
        vpn_wireless: vpnWirelessFalseError || vpnWirelessTrueError ? 'failed' : 'success', 
        multiple_stack: multipleStackFalseError || multipleStackTrueError ? 'failed' : 'success'
      },
      errors: {
        vpn_wired: vpnWiredFalseError || vpnWiredTrueError,
        vpn_wireless: vpnWirelessFalseError || vpnWirelessTrueError,
        multiple_stack: multipleStackFalseError || multipleStackTrueError
      }
    });
    
  } catch (error) {
    console.error('❌ Schema conversion failed:', error);
    return NextResponse.json({
      success: false,
      message: 'Schema conversion failed: ' + (error instanceof Error ? error.message : '알 수 없는 오류'),
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}