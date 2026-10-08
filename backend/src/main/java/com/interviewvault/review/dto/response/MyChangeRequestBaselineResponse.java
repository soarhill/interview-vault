package com.interviewvault.review.dto.response;

import com.interviewvault.interview.dto.response.MyInterviewResponse;

/** 作者读取编辑基线与当前 PENDING 申请：无论有无申请都 200（api-design「读取编辑基线与当前 PENDING 申请」）。 */
public record MyChangeRequestBaselineResponse(MyInterviewResponse interview, ChangeRequestView changeRequest) {
}
