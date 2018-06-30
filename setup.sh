# State variables
app_name="Definely"
resource_name="DefinelyAPI"
region="us-east-1"
lambda_function="api"
aws_account_id


# Begin resource creation.
api_id=$(aws apigateway create-rest-api --name ${app_name} --region ${region} | jq '.id')

root_id=$(aws apigateway get-resources --rest-api-id ${api-id} | jq '.items[0].id')

resource_id = $(aws apigateway create-resource \
--rest-api-id ${api_id} \
--parent-id root-id \
--path-part ${resource_name} | jq '.id')

aws apigateway put-method \
--rest-api-id ${api_id} \
--resource-id ${resource_id} \
--http-method POST \
--authorization-type NONE


aws apigateway put-integration \
--rest-api-id ${api_id} \
--resource-id ${resource_id} \
--http-method POST \
--type AWS \
--integration-http-method POST \
--uri arn:aws:apigateway:aws-region:lambda:path/2015-03-31/functions/arn:aws:lambda:aws-region:aws-acct-id:function:LambdaFunctionOverHttps/invocations

aws apigateway put-method-response \
--rest-api-id ${api_id} \
--resource-id ${resource_id} \
--http-method POST \
--status-code 200 \
--response-models "{\"application/json\": \"Empty\"}"

aws apigateway put-integration-response \
--rest-api-id ${api_id} \
--resource-id ${resource_id} \
--http-method POST \
--status-code 200 \
--response-templates "{\"application/json\": \"\"}"

aws apigateway create-deployment \
--rest-api-id ${api_id} \
--stage-name prod