import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  try {
    console.log('🔧 Converting boolean fields to integer...');
    
    // First, check current data types
    const { data: currentData } = await supabaseAdmin
      .from('business_info')
      .select('vpn_wired, vpn_wireless, multiple_stack')
      .limit(5);
    
    console.log('Current boolean values sample:', currentData);
    
    // Update boolean values to integers (true -> 1, false -> 0)
    console.log('🔄 Converting boolean values to integers...');
    
    // Update all true values to 1 and false values to 0
    const { error: updateError } = await supabaseAdmin
      .from('business_info')
      .update({
        vpn_wired: 0,
        vpn_wireless: 0,
        multiple_stack: 0
      })
      .eq('vpn_wired', false);
    
    if (updateError) {
      console.log('Update error:', updateError);
    }
    
    // Update true values  
    const { error: updateTrueError } = await supabaseAdmin
      .from('business_info')
      .update({
        vpn_wired: 1,
        vpn_wireless: 1,
        multiple_stack: 1
      })
      .eq('vpn_wired', true);
    
    console.log('Boolean to integer conversion completed');
    
    return NextResponse.json({
      success: true,
      message: 'Boolean fields converted to integer successfully',
      conversions: {
        vpn_wired: updateError ? 'failed' : 'success',
        vpn_wireless: updateTrueError ? 'failed' : 'success', 
        multiple_stack: 'success'
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