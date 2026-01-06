# Database Schema Analysis

**Generated**: analyze-database-schema.py

## Tables Used in API Routes

- `activity_logs`
- `ai_verification_log`
- `air_permit_info`
- `air_permit_management`
- `announcements`
- `auto_memo_deletion_logs`
- `business_additional_installation_cost`
- `business_contacts`
- `business_info`
- `business_memos`
- `business_progress_notes`
- `businesses`
- `calendar_events`
- `commission_rate_history`
- `construction_reports`
- `contract_history`
- `contract_templates`
- `crawl_batch_results`
- `crawl_logs`
- `crawl_logs_detailed`
- `crawl_runs`
- `crawl_stats_recent`
- `current_commission_rates`
- `dashboard_layouts`
- `dashboard_targets`
- `dealer_pricing`
- `delivery_addresses`
- `departments`
- `direct_url_sources`
- `discharge_facilities`
- `discharge_outlets`
- `document_history`
- `document_history_detail`
- `employee_team_memberships`
- `employees`
- `equipment_installation_cost`
- `estimate_history`
- `estimate_templates`
- `facility_tasks`
- `facility_tasks_with_business`
- `government_pricing`
- `local_governments`
- `login_attempts`
- `manufacturer_pricing`
- `measurement_devices`
- `mentions`
- `messages`
- `miscellaneous_costs`
- `monthly_closings`
- `notification_history`
- `notification_keywords`
- `notifications`
- `operating_cost_adjustments`
- `order_management`
- `order_management_timeline`
- `organization_changes`
- `organization_changes_detailed`
- `prevention_facilities`
- `pricing_change_history`
- `problem_urls`
- `project_dashboard`
- `project_phases`
- `project_templates`
- `projects`
- `revenue_audit_log`
- `revenue_calculations`
- `router_inventory`
- `sales_office_commission_rates`
- `sales_office_cost_settings`
- `security_events`
- `settings`
- `social_accounts`
- `social_auth_approvals`
- `social_auth_policies`
- `subsidy_announcements`
- `survey_cost_adjustments`
- `survey_cost_settings`
- `survey_events`
- `sync_queue`
- `task_categories`
- `task_comments`
- `task_comments_with_users`
- `task_dashboard`
- `task_details`
- `task_history`
- `task_notification_history`
- `task_notifications`
- `task_statuses`
- `task_watchers`
- `tasks`
- `teams`
- `uploaded_files`
- `url_health_metrics`
- `user_notification_reads`
- `user_notifications`
- `user_sessions`
- `users`
- `v_organization_full`
- `vw_ai_disagreements`
- `vw_recent_crawl_runs`
- `vw_url_health_summary`
- `weekly_reports`

**Total**: 102 tables

## Table Dependencies

- `activity_logs` → `employees`, `projects`
- `ai_verification_log` → `crawl_runs`
- `air_permit_info` → `business_info`, `users`
- `auto_memo_deletion_logs` → `users`
- `business_additional_installation_cost` → `business_info`, `employees`
- `business_contacts` → `businesses`
- `business_info` → `users`
- `business_memos` → `business_info`, `users`
- `contract_history` → `business_info`, `employees`
- `crawl_batch_results` → `crawl_runs`
- `dashboard_layouts` → `employees`
- `dealer_pricing` → `users`
- `delivery_addresses` → `employees`
- `discharge_facilities` → `discharge_outlets`
- `discharge_outlets` → `air_permit_info`
- `document_history` → `business_info`, `document_templates`, `employees`
- `document_templates` → `employees`
- `employee_team_memberships` → `employees`, `teams`
- `equipment_installation_cost` → `employees`
- `estimate_history` → `business_info`, `employees`, `estimate_templates`
- `estimate_templates` → `employees`
- `facility_tasks` → `business_info`
- `government_pricing` → `employees`
- `manufacturer_pricing` → `employees`
- `mentions` → `employees`, `task_comments`, `tasks`
- `miscellaneous_costs` → `monthly_closings`
- `notification_cache` → `employees`
- `notification_delivery_logs` → `notifications`
- `notification_history` → `employees`
- `notification_keywords` → `employees`
- `notification_settings` → `employees`
- `notifications` → `employees`, `projects`, `tasks`
- `operating_cost_adjustments` → `business_info`, `employees`
- `order_management` → `business_info`, `employees`, `facility_tasks`
- `order_management_history` → `business_info`, `employees`, `order_management`
- `organization_changes_detailed` → `departments`, `employees`, `teams`
- `prevention_facilities` → `discharge_outlets`
- `pricing_change_history` → `employees`
- `project_templates` → `departments`, `employees`
- `projects` → `departments`, `employees`
- `push_subscriptions` → `employees`
- `revenue_audit_log` → `employees`
- `revenue_calculations` → `business_info`, `employees`
- `router_inventory` → `business_info`, `order_management`
- `sales_office_cost_settings` → `employees`
- `security_events` → `employees`
- `social_accounts` → `employees`
- `social_auth_approvals` → `employees`
- `survey_cost_adjustments` → `business_info`, `employees`
- `survey_cost_settings` → `employees`
- `survey_events` → `business_info`
- `task_attachments` → `employees`, `task_comments`, `tasks`
- `task_comments` → `employees`, `tasks`
- `task_edit_history` → `facility_tasks`
- `task_notification_history` → `employees`
- `task_notifications` → `employees`, `facility_tasks`
- `task_status_history` → `facility_tasks`
- `task_watchers` → `employees`, `tasks`
- `tasks` → `departments`, `employees`, `projects`
- `url_health_metrics` → `direct_url_sources`
- `user_activity_logs` → `users`
- `user_notification_reads` → `notifications`
- `user_notifications` → `employees`
- `user_sessions` → `employees`, `users`
- `weekly_reports` → `employees`

## Recommended Creation Order

1. `direct_url_sources` (from `create_direct_url_sources.sql`)
2. `monthly_closings` (from `monthly_closings_table.sql`)
3. `businesses` (from `UNKNOWN`)
4. `departments` (from `03_phase1_departments_schema.sql`)
5. `teams` (from `UNKNOWN`)
6. `users` (from `01_users_schema.sql`)
7. `crawl_runs` (from `subsidy_crawler_monitoring.sql`)
8. `employees` (from `00_create_employees_table.sql`)
9. `url_health_metrics` (from `subsidy_crawler_monitoring.sql`)
10. `miscellaneous_costs` (from `monthly_closings_table.sql`)
11. `business_contacts` (from `create_business_contacts.sql`)
12. `dealer_pricing` (from `dealer_pricing_system.sql`)
13. `user_activity_logs` (from `01_users_schema.sql`)
14. `auto_memo_deletion_logs` (from `add_super_admin_permission.sql`)
15. `business_info` (from `create_business_info_only.sql`)
16. `crawl_batch_results` (from `subsidy_crawler_monitoring.sql`)
17. `ai_verification_log` (from `subsidy_crawler_monitoring.sql`)
18. `weekly_reports` (from `weekly_reports_table.sql`)
19. `notification_cache` (from `hybrid_notifications_schema.sql`)
20. `dashboard_layouts` (from `dashboard_layouts_table.sql`)
21. `projects` (from `04_phase2_projects_tasks_schema.sql`)
22. `project_templates` (from `04_phase2_projects_tasks_schema.sql`)
23. `social_accounts` (from `phase1_social_auth_extension.sql`)
24. `user_notifications` (from `phase1_social_auth_extension.sql`)
25. `notification_history` (from `notification_history_system.sql`)
26. `task_notification_history` (from `notification_history_system.sql`)
27. `social_auth_approvals` (from `social_auth_approvals_table.sql`)
28. `employee_team_memberships` (from `organization-integration-schema.sql`)
29. `organization_changes_detailed` (from `organization-integration-schema.sql`)
30. `government_pricing` (from `revenue_management_schema.sql`)
31. `sales_office_cost_settings` (from `revenue_management_schema.sql`)
32. `survey_cost_settings` (from `revenue_management_schema.sql`)
33. `pricing_change_history` (from `revenue_management_schema.sql`)
34. `revenue_audit_log` (from `revenue_management_schema.sql`)
35. `notification_keywords` (from `cleanup_test_notifications.sql`)
36. `estimate_templates` (from `estimate_automation_schema.sql`)
37. `document_templates` (from `document_automation_schema.sql`)
38. `user_sessions` (from `session_security_tables.sql`)
39. `security_events` (from `session_security_tables.sql`)
40. `notification_settings` (from `05_phase3_notifications_schema.sql`)
41. `push_subscriptions` (from `05_phase3_notifications_schema.sql`)
42. `delivery_addresses` (from `delivery_addresses.sql`)
43. `manufacturer_pricing` (from `manufacturer_pricing_system.sql`)
44. `equipment_installation_cost` (from `manufacturer_pricing_system.sql`)
45. `survey_events` (from `create_survey_calendar_sync.sql`)
46. `operating_cost_adjustments` (from `operating_cost_adjustments.sql`)
47. `facility_tasks` (from `01_create_facility_tasks_table.sql`)
48. `contract_history` (from `contract_tables.sql`)
49. `survey_cost_adjustments` (from `revenue_management_schema.sql`)
50. `revenue_calculations` (from `revenue_management_schema.sql`)
51. `air_permit_info` (from `02_business_schema.sql`)
52. `business_memos` (from `02_business_schema.sql`)
53. `business_additional_installation_cost` (from `manufacturer_pricing_system.sql`)
54. `tasks` (from `04_phase2_projects_tasks_schema.sql`)
55. `activity_logs` (from `05_phase3_notifications_schema.sql`)
56. `estimate_history` (from `estimate_automation_schema.sql`)
57. `document_history` (from `document_automation_schema.sql`)
58. `task_notifications` (from `hybrid_notifications_schema.sql`)
59. `task_edit_history` (from `add_edit_history_fields.sql`)
60. `order_management` (from `order_management.sql`)
61. `task_status_history` (from `task_status_history.sql`)
62. `discharge_outlets` (from `02_business_schema.sql`)
63. `task_comments` (from `04_phase2_projects_tasks_schema.sql`)
64. `notifications` (from `create_notifications_base_tables.sql`)
65. `task_watchers` (from `06_phase3_collaboration_schema.sql`)
66. `order_management_history` (from `order_management_history.sql`)
67. `router_inventory` (from `router_inventory.sql`)
68. `discharge_facilities` (from `create_facilities_tables.sql`)
69. `prevention_facilities` (from `create_facilities_tables.sql`)
70. `mentions` (from `05_phase3_notifications_schema.sql`)
71. `task_attachments` (from `06_phase3_collaboration_schema.sql`)
72. `user_notification_reads` (from `create_user_notification_reads.sql`)
73. `notification_delivery_logs` (from `notifications_schema.sql`)
