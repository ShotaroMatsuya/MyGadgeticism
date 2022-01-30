import json
import boto3
import logging
import time
 
def get_schedule_logger():
    import logging
    log_format = '[schedule-%(levelname)s][%(aws_request_id)s][%(funcName)s:%(lineno)d]\t%(message)s'
    formatter = logging.Formatter(log_format)
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    for handler in logger.handlers:
        handler.setFormatter(formatter)
        return logger
 
logger = get_schedule_logger()
 
 
def control_cloudwatch_alarm():
    client = boto3.client('cloudwatch')

    try:
        client.disable_alarm_actions(
            # 無効化するCloudwatchアラーム名
            AlarmNames=[
                "alarm-name1",
                "alarm-name2"
            ]
        )
        logger.info("Enabling CloudWatch Alarm")
    except Exception as e:
        logger.error("Exception: {}".format(e))

def control_ecs_cluster():
    client = boto3.client('ecs')
    # 停止するECS クラスターとサービスを指定
    try:
        for cluster_name, service_name in [('cluster-name', 'service-name'),('cluster-name', 'service-name')]:
            service_update_result = client.update_service(
                cluster = cluster_name,
                service = service_name,
                desiredCount = 0 
            )
            logger.info(service_update_result)
    except Exception as e:
        logger.error("Exception: {}".format(e))


def lambda_handler(event, context):

    control_ecs_cluster()
    control_cloudwatch_alarm()

