/*
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

import React, { useEffect, useState } from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPage,
  EuiPageHeader,
  EuiTitle,
  EuiPageBody,
  EuiPageContent,
  EuiHorizontalRule,
  EuiSpacer,
  EuiPageHeaderSection,
  EuiButton,
  EuiIcon,
  EuiLink,
} from '@elastic/eui';
import { ReportDetailsComponent } from '../report_details/report_details';
import { fileFormatsUpper, generateReport } from '../main_utils';
import { ReportDefinitionSchemaType } from '../../../../server/model';
import moment from 'moment';

export function ReportDefinitionDetails(props) {
  const [reportDefinitionDetails, setReportDefinitionDetails] = useState({});
  const [
    reportDefinitionRawResponse,
    setReportDefinitionRawResponse,
  ] = useState({});
  const reportDefinitionId = props.match['params']['reportDefinitionId'];

  const handleReportDefinitionDetails = (e) => {
    setReportDefinitionDetails(e);
  };

  const handleReportDefinitionRawResponse = (e) => {
    setReportDefinitionRawResponse(e);
  };

  const getReportDefinitionDetailsMetadata = (data) => {
    const reportDefinition: ReportDefinitionSchemaType = data.report_definition;
    const { report_params: reportParams, trigger, delivery, time_created: timeCreated, last_updated: lastUpdated } = reportDefinition
    const { trigger_type: triggerType, trigger_params: triggerParams } = trigger;
    const { delivery_type: deliveryType, delivery_params: deliveryParams } = delivery;
    const { core_params: { base_url: baseUrl, report_format: reportFormat, time_duration: timeDuration} } = reportParams;

    let readableDate = new Date(timeCreated);
    let displayCreatedDate =
      readableDate.toDateString() + ' ' + readableDate.toLocaleTimeString();

    let readableUpdatedDate = new Date(lastUpdated);
    let displayUpdatedDate =
      readableUpdatedDate.toDateString() +
      ' ' +
      readableUpdatedDate.toLocaleTimeString();

    let reportDefinitionDetails = {
      name: reportParams.report_name,
      description: reportParams.description,
      created: displayCreatedDate,
      lastUpdated: displayUpdatedDate,
      source: reportParams.report_source,
      baseUrl: baseUrl,
      // TODO: need better display
      timePeriod: moment.duration(timeDuration).humanize(),
      fileFormat: reportFormat,
      // TODO: to be added to schema, currently hardcoded in backend
      reportHeader: `\u2014`,
      reportFooter: `\u2014`,
      triggerType: triggerType,
      scheduleDetails: triggerParams ? triggerParams.schedule_type : `\u2014`,
      alertDetails: `\u2014`,
      channel: deliveryType,
      status: reportDefinition.status,
      kibanaRecipients: deliveryParams.kibana_recipients ? deliveryParams.kibana_recipients : `\u2014`,
      emailRecipients: deliveryType === 'Channel' ? deliveryParams.recipients : `\u2014`,
      emailSubject: deliveryType === 'Channel' ? deliveryParams.title : `\u2014`,
      emailBody: deliveryType === 'Channel' ? deliveryParams.textDescription : `\u2014`,
      reportAsAttachment: (deliveryType === 'Channel' && deliveryParams.email_format === 'Attachment')? 'True' : 'False',
    };
    return reportDefinitionDetails;
  };

  useEffect(() => {
    const { httpClient } = props;
    httpClient
      .get(`../api/reporting/reportDefinitions/${reportDefinitionId}`)
      .then((response) => {
        handleReportDefinitionRawResponse(response);
        handleReportDefinitionDetails(
          getReportDefinitionDetailsMetadata(response)
        );
        props.setBreadcrumbs([
          {
            text: 'Reporting',
            href: '#',
          },
          {
            text: `Report definition details: ${response.report_definition.report_params.report_name}`,
          },
        ]);
      })
      .catch((error) => {
        console.error('error when getting report definition details:', error);
      });
  }, []);

  const fileFormatDownload = (data) => {
    let formatUpper = data['fileFormat'];
    formatUpper = fileFormatsUpper[formatUpper];
    return (
      <EuiLink>
        {formatUpper + ' '}
        <EuiIcon type="importAction" />
      </EuiLink>
    );
  };

  const sourceURL = (data) => {
    return (
      <EuiLink href={data.baseUrl} target="_blank">
        {data['source']}
      </EuiLink>
    );
  };

  const getRelativeStartDate = (duration) => {
    duration = moment.duration(duration);
    let time_difference = moment.now() - duration;
    return new Date(time_difference);
  };

  const changeScheduledReportDefinitionStatus = (statusChange) => {
    let updatedReportDefinition = reportDefinitionRawResponse.report_definition;
    if (statusChange === 'Disable') {
      updatedReportDefinition.trigger.trigger_params.enabled = false;
      updatedReportDefinition.status = 'Disabled';
    } else if (statusChange === 'Enable') {
      updatedReportDefinition.trigger.trigger_params.enabled = true;
      updatedReportDefinition.status = 'Active';
    }

    // update report definition, delete extraneous schedule params
    if (
      updatedReportDefinition.trigger.trigger_params.schedule_type ===
      'Recurring'
    ) {
      delete updatedReportDefinition.trigger.trigger_params.schedule.cron;
    } else if (
      updatedReportDefinition.trigger.trigger_params.schedule_type ===
      'Cron based'
    ) {
      delete updatedReportDefinition.trigger.trigger_params.schedule.interval;
    }
    const { httpClient } = props;
    httpClient
      .put(`../api/reporting/reportDefinitions/${reportDefinitionId}`, {
        body: JSON.stringify(updatedReportDefinition),
        params: reportDefinitionId.toString(),
      })
      .then(() => {
        const updatedRawResponse = { report_definition: {} };
        updatedRawResponse.report_definition = updatedReportDefinition;
        handleReportDefinitionRawResponse(updatedRawResponse);
        setReportDefinitionDetails(
          getReportDefinitionDetailsMetadata(updatedRawResponse)
        );
      })
      .catch((error) => {
        console.error('error in updating report definition status:', error);
      });
  };

  const ScheduledDefinitionStatus = () => {
    const status =
      reportDefinitionDetails.status === 'Active' ? 'Disable' : 'Enable';

    return (
      <EuiButton onClick={() => changeScheduledReportDefinitionStatus(status)}>
        {status}
      </EuiButton>
    );
  };

  const generateReportFromDetails = () => {
    let duration =
      reportDefinitionRawResponse.report_definition.report_params.core_params
        .time_duration;
    const fromDate = getRelativeStartDate(duration);
    let onDemandDownloadMetadata = {
      query_url: `${
        reportDefinitionDetails.baseUrl
      }?_g=(time:(from:'${fromDate.toISOString()}',to:'${moment().toISOString()}'))`,
      time_from: fromDate.valueOf(),
      time_to: moment().valueOf(),
      report_definition: reportDefinitionRawResponse.report_definition,
    };
    const { httpClient } = props;
    generateReport(onDemandDownloadMetadata, httpClient);
  };

  const deleteReportDefinition = () => {
    const { httpClient } = props;
    httpClient
      .delete(`../api/reporting/reportDefinitions/${reportDefinitionId}`)
      .then(() => {
        window.location.assign(`opendistro_kibana_reports#/`);
      })
      .catch((error) => {
        console.log('error when deleting report definition:', error);
      });
  };

  const showActionButton = (reportDefinitionDetails.triggerType === 'On demand')
    ? <EuiButton onClick={() => generateReportFromDetails()}>Generate report</EuiButton>
    : <ScheduledDefinitionStatus/>

  return (
    <EuiPage>
      <EuiPageBody>
        <EuiTitle size="l">
          <h1>Report definition details</h1>
        </EuiTitle>
        <EuiSpacer size="m" />
        <EuiPageContent panelPaddingSize={'l'}>
          <EuiPageHeader>
            <EuiFlexGroup>
              <EuiFlexItem>
                <EuiPageHeaderSection>
                  <EuiTitle>
                    <h2>{reportDefinitionDetails.name}</h2>
                  </EuiTitle>
                </EuiPageHeaderSection>
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiFlexGroup
              justifyContent="flexEnd"
              alignItems="flexEnd"
              gutterSize="l"
            >
              <EuiFlexItem grow={false}>
                <EuiButton color={'danger'} onClick={deleteReportDefinition}>
                  Delete
                </EuiButton>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>{showActionButton}</EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButton
                  fill={true}
                  onClick={() => {
                    window.location.assign(
                      `opendistro_kibana_reports#/edit/${reportDefinitionId}`
                    );
                  }}
                >
                  Edit
                </EuiButton>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiPageHeader>
          <EuiHorizontalRule />
          <EuiTitle>
            <h3>Report settings</h3>
          </EuiTitle>
          <EuiSpacer />
          <EuiFlexGroup>
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Name'}
              reportDetailsComponentContent={reportDefinitionDetails.name}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Description'}
              reportDetailsComponentContent={
                reportDefinitionDetails.description
              }
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Created'}
              reportDetailsComponentContent={reportDefinitionDetails.created}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Last updated'}
              reportDetailsComponentContent={
                reportDefinitionDetails.lastUpdated
              }
            />
          </EuiFlexGroup>
          <EuiSpacer />
          <EuiFlexGroup>
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Source'}
              reportDetailsComponentContent={sourceURL(reportDefinitionDetails)}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Time period'}
              reportDetailsComponentContent={`Last ${reportDefinitionDetails.timePeriod}`}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'File format'}
              reportDetailsComponentContent={fileFormatDownload(
                reportDefinitionDetails
              )}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Report header'}
              reportDetailsComponentContent={
                reportDefinitionDetails.reportHeader
              }
            />
          </EuiFlexGroup>
          <EuiSpacer />
          <EuiFlexGroup>
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Report footer'}
              reportDetailsComponentContent={
                reportDefinitionDetails.reportFooter
              }
            />
            <ReportDetailsComponent />
            <ReportDetailsComponent />
            <ReportDetailsComponent />
          </EuiFlexGroup>
          <EuiSpacer />
          <EuiTitle>
            <h3>Report trigger</h3>
          </EuiTitle>
          <EuiSpacer />
          <EuiFlexGroup>
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Trigger type'}
              reportDetailsComponentContent={
                reportDefinitionDetails.triggerType
              }
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Schedule details'}
              reportDetailsComponentContent={
                reportDefinitionDetails.scheduleDetails
              }
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Alert details'}
              reportDetailsComponentContent={
                reportDefinitionDetails.alertDetails
              }
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Status'}
              reportDetailsComponentContent={reportDefinitionDetails.status}
            />
          </EuiFlexGroup>
          <EuiSpacer />
          <EuiTitle>
            <h3>Delivery settings</h3>
          </EuiTitle>
          <EuiSpacer />
          <EuiFlexGroup>
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Channel'}
              reportDetailsComponentContent={
                reportDefinitionDetails.channel
              }
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Kibana recipients'}
              reportDetailsComponentContent={
                reportDefinitionDetails.kibanaRecipients
              }
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Email recipients'}
              reportDetailsComponentContent={
                reportDefinitionDetails.emailRecipients
              }
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Email subject'}
              reportDetailsComponentContent={
                reportDefinitionDetails.emailSubject
              }
            />
          </EuiFlexGroup>
          <EuiSpacer />
          <EuiFlexGroup>
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Email body'}
              reportDetailsComponentContent={reportDefinitionDetails.emailBody}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Include report as attachment'}
              reportDetailsComponentContent={reportDefinitionDetails.reportAsAttachment}
            />
            <ReportDetailsComponent />
            <ReportDetailsComponent />
          </EuiFlexGroup>
        </EuiPageContent>
      </EuiPageBody>
    </EuiPage>
  );
}