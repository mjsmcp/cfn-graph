#!/bin/bash
BUILD_ID=$(date +'%s')
DEPLOY_BUCKET="cfn-graph.mjsmcp.com"
STACK_NAME="CfnGraphStack"

. ./aws_configure

# run build
rm -r build/*
mkdir build/${BUILD_ID}
cp -r src/* build/${BUILD_ID}/

# deploy files
aws s3 cp --acl public-read --recursive build/${BUILD_ID} "s3://${DEPLOY_BUCKET}/${BUILD_ID}"

# deploy cloudformation
DESCRIBE_RESULT=$(aws cloudformation describe-stacks --stack-name ${STACK_NAME} 2>&1)

if [[ $DESCRIBE_RESULT == *"does not exist"* ]]; then
  aws cloudformation create-stack --stack-name ${STACK_NAME} --template-body file://basic_cfn.template.yml
  sleep 30s
fi

CHANGESET_ID=$(aws cloudformation create-change-set --change-set-name "CS-${BUILD_ID}" --stack-name ${STACK_NAME} --template-body file://cloudformation.template.yml --parameters \
ParameterKey=TargetBucket,ParameterValue=${DEPLOY_BUCKET} \
ParameterKey=BuildId,ParameterValue=${BUILD_ID} \
--query "Id" | sed 's/"//g')

sleep 10s

aws cloudformation execute-change-set --change-set-name "${CHANGESET_ID}"